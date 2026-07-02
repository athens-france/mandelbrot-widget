
const vsSource = `
  attribute vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

function fsSource(isJulia) {
    return `
    precision highp float;
    uniform vec2 uResolution;
    uniform vec2 uCenter;
    uniform float uScale;
    uniform int uMaxIter;
    ${isJulia ? 'uniform vec2 uC;' : ''}

    vec3 palette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.0, 0.10, 0.20);
        return a + b * cos(6.28318 * (c * t + d));
    }
    
    void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
        ${isJulia
            ? 'vec2 z = uCenter + uv * uScale; vec2 c = uC;'
            : 'vec2 c = uCenter + uv * uScale; vec2 z = vec2(0.0);'}
        float iter = 0.0;
        const int MAX = 1000;
        for (int i = 0; i < MAX; i++) {
            if (i>= uMaxIter) break;
            // complex multiplication: (a+bi)^2 = a^2-b^2 + 2abi
            if (dot(z, z) > 4.0) { // |z|^2 > 2^2, cheaper than sqrt
                break;
            }
            z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
            iter += 1.0; // for banding
        
        }

        if (iter >= float(uMaxIter)) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
            float sl = iter - log2(log2(dot(z, z))) + 4.0;
            float t = sl / float(uMaxIter);
            gl_FragColor = vec4(palette(t * 3.0 + 0.6), 1.0); 
        }
    }`;
}

function makeRenderer(canvasId, isJulia) {
  const canvas = document.getElementById(canvasId);
  const gl = canvas.getContext('webgl');
  if (!gl) return null;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSource(isJulia));
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(fs));

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1,  1,  1, -1,   1, 1
  ]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uCenter = gl.getUniformLocation(program, 'uCenter');
  const uScale = gl.getUniformLocation(program, 'uScale');
  const uMaxIter = gl.getUniformLocation(program, 'uMaxIter');
  const uC = isJulia ? gl.getUniformLocation(program, 'uC') : null;

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  return {
    canvas, resize,
    render(centerX, centerY, scale, maxIter, cx, cy) {
      resize();
      gl.useProgram(program);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uCenter, centerX, centerY);
      gl.uniform1f(uScale, scale);
      gl.uniform1i(uMaxIter, maxIter);
      if (isJulia) gl.uniform2f(uC, cx, cy);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
}

function screenToWorld(canvas, e, centerX, centerY, scale) {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = 1.0 - (e.clientY - rect.top) / rect.height;
  const aspect = rect.width / rect.height;
  return {
    x: centerX + (mx - 0.5) * scale * aspect,
    y: centerY + (my - 0.5) * scale
  };
}

const mandel = makeRenderer('mandel', false);
const julia = makeRenderer('julia', true);

const mandelPane = document.getElementById('mandelPane');
const juliaPane = document.getElementById('juliaPane');
const divider = document.getElementById('divider');

let splitVisible = false;

let mCenterX = -0.5, mCenterY = 0.0, mScale = 3.0;
let jCenterX = 0.0, jCenterY = 0.0, jScale = 3.0;
let cX = -0.5, cY = 0.6;
let maxIter = 220;

function setSplit(show) {
  if (splitVisible === show) return;
  splitVisible = show;

  if (show) {
    mandelPane.style.width = '50%';
    juliaPane.style.display = 'block';
    divider.style.display = 'block';
  } else {
    mandelPane.style.width = '100%';
    juliaPane.style.display = 'none';
    divider.style.display = 'none';
  }

  renderBoth();
}

function renderBoth() {
  mandel.render(mCenterX, mCenterY, mScale, maxIter);
  if (splitVisible) {
    julia.render(jCenterX, jCenterY, jScale, maxIter, cX, cY);
  }
  document.getElementById('mandelInfo').textContent =
    `MANDELBROT, left drag = pick c, right drag = pan, wheel = zoom, hold CTRL to show julia set. [c = (${cX.toFixed(5)}, ${cY.toFixed(5)})]`;
  document.getElementById('juliaInfo').textContent =
    `JULIA set, left click/drag in Mandelbrot chooses c`;
}

function screenToWorld(canvas, e, centerX, centerY, scale) {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = 1.0 - (e.clientY - rect.top) / rect.height;
  const aspect = rect.width / rect.height;
  return {
    x: centerX + (mx - 0.5) * scale * aspect,
    y: centerY + (my - 0.5) * scale
  };
}

let mDragging = false, mLastX, mLastY, mRightPan = false;

mandel.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

mandel.canvas.addEventListener('mousedown', (e) => {
  // left = choose c right = pan
  if (e.button !== 0 && e.button !== 2) return;

  mDragging = true;
  mRightPan = (e.button === 2);
  mLastX = e.clientX; mLastY = e.clientY;

  if (!mRightPan) {
    const w = screenToWorld(mandel.canvas, e, mCenterX, mCenterY, mScale);
    cX = w.x; cY = w.y;
    renderBoth();
  }

  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!mDragging) return;
  if (mRightPan) {
    const rect = mandel.canvas.getBoundingClientRect();
    const dx = (e.clientX - mLastX) / rect.height * mScale;
    const dy = (e.clientY - mLastY) / rect.height * mScale;
    mCenterX -= dx; mCenterY += dy;
    mLastX = e.clientX; mLastY = e.clientY;
  } else {
    const w = screenToWorld(mandel.canvas, e, mCenterX, mCenterY, mScale);
    cX = w.x; cY = w.y;
  }
  renderBoth();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0 || e.button === 2) {
    mDragging = false;
    mRightPan = false;
  }
});

mandel.canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = mandel.canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = 1.0 - (e.clientY - rect.top) / rect.height;
  const aspect = rect.width / rect.height;
  const worldX = mCenterX + (mx - 0.5) * mScale * aspect;
  const worldY = mCenterY + (my - 0.5) * mScale;
  const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
  mScale *= zoomFactor;
  mCenterX = worldX - (mx - 0.5) * mScale * aspect;
  mCenterY = worldY - (my - 0.5) * mScale;
  renderBoth();
}, { passive: false });

let jDragging = false, jLastX, jLastY;
julia.canvas.addEventListener('mousedown', (e) => {
  if (!splitVisible) return;
  jDragging = true;
  jLastX = e.clientX; jLastY = e.clientY;
});
window.addEventListener('mousemove', (e) => {
  if (!jDragging || !splitVisible) return;
  const rect = julia.canvas.getBoundingClientRect();
  const dx = (e.clientX - jLastX) / rect.height * jScale;
  const dy = (e.clientY - jLastY) / rect.height * jScale;
  jCenterX -= dx; jCenterY += dy;
  jLastX = e.clientX; jLastY = e.clientY;
  renderBoth();
});
window.addEventListener('mouseup', () => jDragging = false);

julia.canvas.addEventListener('wheel', (e) => {
  if (!splitVisible) return;
  e.preventDefault();
  const rect = julia.canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = 1.0 - (e.clientY - rect.top) / rect.height;
  const aspect = rect.width / rect.height;
  const worldX = jCenterX + (mx - 0.5) * jScale * aspect;
  const worldY = jCenterY + (my - 0.5) * jScale;
  const zoomFactor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
  jScale *= zoomFactor;
  jCenterX = worldX - (mx - 0.5) * jScale * aspect;
  jCenterY = worldY - (my - 0.5) * jScale;
  renderBoth();
}, { passive: false });

// [ and ] adjust quality/perf by changing iteration cap
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (e.key === 'Control') {
    setSplit(!splitVisible);
    return;
  }

  if (e.key === '[') maxIter = Math.max(20, maxIter - 50);
  if (e.key === ']') maxIter = Math.min(2000, maxIter + 50);
  renderBoth();
});

window.addEventListener('resize', renderBoth);
renderBoth();
