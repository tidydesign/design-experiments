// WebGL2-рендер ленты: каждое фото — полоска из горизонтальных сегментов,
// вершинный шейдер выгибает её дугой, фрагментный раскладывает каналы внутри фото.

const ROWS = 64 // сегментов по высоте — чем больше, тем глаже дуга

const VERT = /* glsl */ `#version 300 es
in vec2 aUv;
uniform vec4 uRect;   // x, y, w, h в CSS px
uniform vec2 uRes;    // размер экрана в CSS px
uniform float uBend;  // смещение центра фото относительно верха/низа, px
out vec2 vUv;
void main() {
  vec2 p = uRect.xy + aUv * uRect.zw;
  float t = aUv.y * 2.0 - 1.0;      // -1 сверху, 1 снизу
  p.x += uBend * (1.0 - t * t);     // парабола: середина впереди, края отстают
  vec2 clip = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aUv;
}`

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uSplit; // смещение каналов в долях ширины фото
out vec4 outColor;

// Выборка за пределами фото = чёрный: раскладка не выходит за маску
float channel(vec2 uv, int c) {
  if (uv.x < 0.0 || uv.x > 1.0) return 0.0;
  return texture(uTex, uv)[c];
}

void main() {
  vec2 d = vec2(uSplit, 0.0);
  float r = channel(vUv + d, 0); // красный отстаёт от движения
  float g = channel(vUv, 1);
  float b = channel(vUv - d, 2); // синий забегает вперёд
  outColor = vec4(r, g, b, 1.0);
}`

export type Sprite = {
  tex: WebGLTexture
  w: number // натуральные пиксели картинки
  h: number
}

export type DrawItem = {
  sprite: Sprite
  x: number
  y: number
  w: number
  h: number
  bend: number
  split: number // px
}

export function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })
  if (!gl) throw new Error('WebGL2 is not supported')

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
  gl.useProgram(prog)

  // Полоска (triangle strip): пары вершин слева/справа на каждом ряду
  const uvs = new Float32Array((ROWS + 1) * 4)
  for (let i = 0; i <= ROWS; i++) {
    const v = i / ROWS
    uvs.set([0, v, 1, v], i * 4)
  }
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
  const aUv = gl.getAttribLocation(prog, 'aUv')
  gl.enableVertexAttribArray(aUv)
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)

  const u = {
    rect: gl.getUniformLocation(prog, 'uRect'),
    res: gl.getUniformLocation(prog, 'uRes'),
    bend: gl.getUniformLocation(prog, 'uBend'),
    split: gl.getUniformLocation(prog, 'uSplit'),
    tex: gl.getUniformLocation(prog, 'uTex'),
  }
  gl.uniform1i(u.tex, 0)

  let cssW = 0
  let cssH = 0
  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 2)
    cssW = canvas.clientWidth
    cssH = canvas.clientHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }
  resize()

  const createSprite = (img: HTMLImageElement): Sprite => {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return { tex, w: img.naturalWidth, h: img.naturalHeight }
  }

  const draw = (items: DrawItem[]) => {
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(u.res, cssW, cssH)
    for (const it of items) {
      gl.bindTexture(gl.TEXTURE_2D, it.sprite.tex)
      gl.uniform4f(u.rect, it.x, it.y, it.w, it.h)
      gl.uniform1f(u.bend, it.bend)
      gl.uniform1f(u.split, it.split / it.w)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (ROWS + 1) * 2)
    }
  }

  return {
    resize,
    createSprite,
    draw,
    get width() {
      return cssW
    },
    get height() {
      return cssH
    },
  }
}
