// WebGL2-рендер стека: каждый кадр 16:9 — сетка из горизонтальных полос.
// Вершинный шейдер наматывает ленту на барабан (цилиндр с горизонтальной осью) и даёт перспективу.

const ROWS = 48 // полос на кадр — чем больше, тем глаже изгиб

const VERT = /* glsl */ `#version 300 es
in vec2 aUv;
uniform vec4 uRect;     // x, y, w, h кадра в плоской раскладке, CSS px
uniform vec2 uRes;      // размер экрана, CSS px
uniform float uCurv;    // кривизна барабана, 1/px (0 — плоско)
uniform float uPersp;   // расстояние до камеры, px
uniform vec4 uCrop;     // обрезка под 16:9: offset.xy, scale.zw
out vec2 vUv;
out float vCos;
void main() {
  vec2 p = uRect.xy + aUv * uRect.zw;
  vec2 c = uRes * 0.5;
  float d = p.y - c.y;                 // расстояние по ленте от центра экрана
  float y = d;
  float z = 0.0;
  float cosT = 1.0;
  if (uCurv > 1e-6) {
    float t = d * uCurv;               // угол на барабане
    y = sin(t) / uCurv;
    z = (cos(t) - 1.0) / uCurv;        // уходит вглубь
    cosT = cos(t);
  }
  float s = uPersp / (uPersp - z);     // перспектива
  vec2 q = vec2(c.x + (p.x - c.x) * s, c.y + y * s);
  vec2 clip = q / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = uCrop.xy + aUv * uCrop.zw;
  vCos = cosT;
}`

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in float vCos;
uniform sampler2D uTex;
uniform float uShade;
out vec4 outColor;
void main() {
  if (vCos < 0.0) discard;             // задняя сторона барабана
  vec3 col = texture(uTex, vUv).rgb;
  col *= mix(1.0, vCos, uShade);       // чем сильнее повёрнут кадр, тем темнее
  outColor = vec4(col, 1.0);
}`

export type Sprite = { tex: WebGLTexture; crop: [number, number, number, number] }
export type DrawItem = { sprite: Sprite; x: number; y: number; w: number; h: number }

const FRAME_ASPECT = 16 / 9

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

  const uvs = new Float32Array((ROWS + 1) * 4)
  for (let i = 0; i <= ROWS; i++) uvs.set([0, i / ROWS, 1, i / ROWS], i * 4)
  gl.bindVertexArray(gl.createVertexArray())
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW)
  const aUv = gl.getAttribLocation(prog, 'aUv')
  gl.enableVertexAttribArray(aUv)
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)

  const u = Object.fromEntries(
    ['uRect', 'uRes', 'uCurv', 'uPersp', 'uCrop', 'uTex', 'uShade'].map((n) => [n, gl.getUniformLocation(prog, n)]),
  )
  gl.uniform1i(u.uTex, 0)

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

  // Текстура + обрезка «cover» под кадр 16:9
  const createSprite = (img: HTMLImageElement): Sprite => {
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const a = img.naturalWidth / img.naturalHeight
    const sx = a > FRAME_ASPECT ? FRAME_ASPECT / a : 1
    const sy = a > FRAME_ASPECT ? 1 : a / FRAME_ASPECT
    return { tex, crop: [(1 - sx) / 2, (1 - sy) / 2, sx, sy] }
  }

  const draw = (items: DrawItem[], curvature: number, perspective: number, shade: number) => {
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(u.uRes, cssW, cssH)
    gl.uniform1f(u.uCurv, curvature)
    gl.uniform1f(u.uPersp, perspective)
    gl.uniform1f(u.uShade, shade)
    for (const it of items) {
      gl.bindTexture(gl.TEXTURE_2D, it.sprite.tex)
      gl.uniform4f(u.uRect, it.x, it.y, it.w, it.h)
      gl.uniform4f(u.uCrop, ...it.sprite.crop)
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
