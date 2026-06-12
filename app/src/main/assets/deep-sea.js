const PARTICLE_COUNT = 1200;
const GLOW_COUNT = 180;
const MAX_PIXEL_RATIO = 1.5;

class DeepSeaAmbient {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            powerPreference: 'default',
            preserveDrawingBuffer: false,
        });
        if (!this.gl) {
            throw new Error('WebGL is not available');
        }

        this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        this.startTime = performance.now();
        this.lastFrameTime = this.startTime;
        this.frameHandle = 0;
        this.isRunning = false;
        this.alarmIntensity = 0;
        this.visibilityPaused = false;
        this.bounds = { width: 1, height: 1, aspect: 1 };

        this.creatures = createCreatures();
        this.resize = this.resize.bind(this);
        this.render = this.render.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleContextLost = this.handleContextLost.bind(this);
        this.handleContextRestored = this.handleContextRestored.bind(this);

        this.initializePrograms();
        this.initializeBuffers();
        this.resize();
        window.addEventListener('resize', this.resize);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
        canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    }

    initializePrograms() {
        const gl = this.gl;
        this.backgroundProgram = createProgram(gl, BACKGROUND_VERTEX_SHADER, BACKGROUND_FRAGMENT_SHADER);
        this.particleProgram = createProgram(gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
        this.creatureProgram = createProgram(gl, CREATURE_VERTEX_SHADER, CREATURE_FRAGMENT_SHADER);
        this.lineProgram = createProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
    }

    initializeBuffers() {
        const gl = this.gl;
        this.fullscreenBuffer = createStaticBuffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
        this.snowBuffer = createParticleBuffer(gl, PARTICLE_COUNT, 0);
        this.glowBuffer = createParticleBuffer(gl, GLOW_COUNT, 1);
        this.fishBuffer = createStaticBuffer(gl, createFishVertices());
        this.fishVertexCount = createFishVertices().length / 2;
        this.jellyBellBuffer = createStaticBuffer(gl, createJellyBellVertices());
        this.jellyBellVertexCount = createJellyBellVertices().length / 2;
        this.giantBuffer = createStaticBuffer(gl, createEllipseVertices(36, 1, 0.28));
        this.giantVertexCount = createEllipseVertices(36, 1, 0.28).length / 2;
        this.tentacleBuffer = createDynamicBuffer(gl, 6 * 14 * 2);
    }

    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.frameHandle = window.requestAnimationFrame(this.render);
    }

    stop() {
        this.isRunning = false;
        window.cancelAnimationFrame(this.frameHandle);
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this.resize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    handleVisibilityChange() {
        this.visibilityPaused = document.hidden;
        if (document.hidden) {
            this.stop();
        } else {
            this.start();
        }
    }

    handleContextLost(event) {
        event.preventDefault();
        this.stop();
        document.documentElement.classList.add('webgl-fallback');
    }

    handleContextRestored() {
        this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false });
        this.initializePrograms();
        this.initializeBuffers();
        this.resize();
        document.documentElement.classList.remove('webgl-fallback');
        this.start();
    }

    resize() {
        const width = Math.max(1, window.innerWidth);
        const height = Math.max(1, window.innerHeight);
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        const drawingWidth = Math.floor(width * this.pixelRatio);
        const drawingHeight = Math.floor(height * this.pixelRatio);
        if (this.canvas.width !== drawingWidth || this.canvas.height !== drawingHeight) {
            this.canvas.width = drawingWidth;
            this.canvas.height = drawingHeight;
        }
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.bounds = { width: drawingWidth, height: drawingHeight, aspect: width / height };
        this.gl.viewport(0, 0, drawingWidth, drawingHeight);
    }

    render(now) {
        if (!this.isRunning) {
            return;
        }

        const gl = this.gl;
        const time = (now - this.startTime) * 0.001;
        const delta = Math.min(0.05, (now - this.lastFrameTime) * 0.001);
        this.lastFrameTime = now;
        this.alarmIntensity += (readAlarmIntensity() - this.alarmIntensity) * Math.min(1, delta * 0.8);

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0.004, 0.008, 0.016, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        this.drawBackground(time);
        this.drawDistantCreatures(time);
        this.drawParticles(time, this.snowBuffer, PARTICLE_COUNT, 0);
        this.drawParticles(time, this.glowBuffer, GLOW_COUNT, 1);
        this.drawCreatures(time);

        this.frameHandle = window.requestAnimationFrame(this.render);
    }

    drawBackground(time) {
        const gl = this.gl;
        const program = this.backgroundProgram;
        gl.useProgram(program);
        bindFloatAttribute(gl, program, this.fullscreenBuffer, 'aPosition', 2, 0, 0);
        setUniform1f(gl, program, 'uTime', time);
        setUniform1f(gl, program, 'uAlarm', this.alarmIntensity);
        setUniform1f(gl, program, 'uAspect', this.bounds.aspect);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    drawParticles(time, buffer, count, mode) {
        const gl = this.gl;
        const program = this.particleProgram;
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        bindInterleavedAttribute(gl, program, 'aPosition', 3, 5 * 4, 0);
        bindInterleavedAttribute(gl, program, 'aSeed', 2, 5 * 4, 3 * 4);
        setUniform1f(gl, program, 'uTime', time);
        setUniform1f(gl, program, 'uAspect', this.bounds.aspect);
        setUniform1f(gl, program, 'uPixelRatio', this.pixelRatio);
        setUniform1f(gl, program, 'uAlarm', this.alarmIntensity);
        setUniform1f(gl, program, 'uMode', mode);
        gl.blendFunc(mode === 1 ? gl.SRC_ALPHA : gl.SRC_ALPHA, mode === 1 ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    drawDistantCreatures(time) {
        this.creatures.giants.forEach((giant) => {
            const state = getCreatureState(giant, time, this.bounds.aspect);
            this.drawMesh(this.giantBuffer, this.giantVertexCount, state, [0.005, 0.011, 0.018, 0.28 + this.alarmIntensity * 0.05], 'TRIANGLE_FAN');
        });
    }

    drawCreatures(time) {
        this.creatures.fish.forEach((fish) => {
            const state = getCreatureState(fish, time, this.bounds.aspect);
            this.drawMesh(this.fishBuffer, this.fishVertexCount, state, [0.01, 0.018, 0.026, 0.42], 'TRIANGLE_FAN');
        });

        this.creatures.jelly.forEach((jelly) => {
            const state = getCreatureState(jelly, time, this.bounds.aspect);
            const alpha = 0.28 + 0.08 * Math.sin(time * 0.9 + jelly.seed) + this.alarmIntensity * 0.05;
            this.drawMesh(this.jellyBellBuffer, this.jellyBellVertexCount, state, [0.28, 0.68, 0.82, alpha], 'TRIANGLE_FAN');
            this.drawTentacles(jelly, state, time);
        });
    }

    drawMesh(buffer, count, state, color, drawMode) {
        const gl = this.gl;
        const program = this.creatureProgram;
        gl.useProgram(program);
        bindFloatAttribute(gl, program, buffer, 'aPosition', 2, 0, 0);
        setUniform2f(gl, program, 'uCenter', state.x, state.y);
        setUniform2f(gl, program, 'uScale', state.scaleX, state.scaleY);
        setUniform1f(gl, program, 'uRotation', state.rotation);
        setUniform1f(gl, program, 'uAspect', this.bounds.aspect);
        setUniform1f(gl, program, 'uDepth', state.depth);
        setUniform1f(gl, program, 'uTime', state.time);
        setUniform4f(gl, program, 'uColor', color[0], color[1], color[2], color[3]);
        gl.drawArrays(gl[drawMode], 0, count);
    }

    drawTentacles(jelly, state, time) {
        const vertices = [];
        for (let strand = 0; strand < 6; strand += 1) {
            const offset = (strand - 2.5) * 0.11;
            for (let point = 0; point < 14; point += 1) {
                const p = point / 13;
                const lag = Math.sin(time * 1.1 + jelly.seed + strand * 0.7 + p * 4.5) * 0.05;
                vertices.push(offset + lag * (0.4 + p), -0.1 - p * (0.75 + jelly.scale * 0.08));
            }
        }

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tentacleBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(vertices));

        const program = this.lineProgram;
        gl.useProgram(program);
        bindFloatAttribute(gl, program, this.tentacleBuffer, 'aPosition', 2, 0, 0);
        setUniform2f(gl, program, 'uCenter', state.x, state.y - state.scaleY * 0.04);
        setUniform2f(gl, program, 'uScale', state.scaleX, state.scaleY);
        setUniform1f(gl, program, 'uRotation', state.rotation * 0.18);
        setUniform1f(gl, program, 'uAspect', this.bounds.aspect);
        setUniform4f(gl, program, 'uColor', 0.2, 0.78, 0.92, 0.16 + this.alarmIntensity * 0.05);
        for (let strand = 0; strand < 6; strand += 1) {
            gl.drawArrays(gl.LINE_STRIP, strand * 14, 14);
        }
    }
}

function createCreatures() {
    return {
        jelly: Array.from({ length: 4 }, (_, index) => ({
            seed: 10 + index * 3.71,
            baseX: [-0.68, 0.44, -0.22, 0.72][index],
            baseY: [-0.12, 0.26, 0.54, -0.38][index],
            scale: [0.72, 0.56, 0.44, 0.62][index],
            speed: [0.065, 0.052, 0.045, 0.058][index],
            type: 'jelly',
        })),
        fish: Array.from({ length: 6 }, (_, index) => ({
            seed: 30 + index * 4.13,
            baseX: -1.25 + index * 0.47,
            baseY: [-0.52, -0.18, 0.06, 0.36, -0.34, 0.18][index],
            scale: [0.52, 0.42, 0.36, 0.5, 0.32, 0.46][index],
            speed: [0.04, -0.036, 0.032, -0.045, 0.035, -0.03][index],
            type: 'fish',
        })),
        giants: Array.from({ length: 2 }, (_, index) => ({
            seed: 80 + index * 9.2,
            baseX: index === 0 ? -0.55 : 0.82,
            baseY: index === 0 ? 0.12 : -0.08,
            scale: index === 0 ? 1.85 : 1.28,
            speed: index === 0 ? 0.012 : -0.01,
            type: 'giant',
        })),
    };
}

function getCreatureState(creature, time, aspect) {
    const seed = creature.seed;
    const travel = Math.sin(time * creature.speed + seed) * (creature.type === 'giant' ? 0.24 : 0.36);
    const drift = Math.sin(time * creature.speed * 2.7 + seed * 1.7) * 0.08;
    const bob = Math.sin(time * (creature.type === 'jelly' ? 0.48 : 0.28) + seed) * 0.05;
    const direction = creature.speed < 0 ? -1 : 1;
    const depth = creature.type === 'giant' ? 4.2 : creature.type === 'fish' ? 2.5 : 1.9;
    return {
        x: creature.baseX + travel / Math.max(1, aspect * 0.7),
        y: creature.baseY + bob + drift,
        scaleX: creature.scale * (creature.type === 'fish' ? direction : 1),
        scaleY: creature.scale,
        rotation: Math.sin(time * 0.25 + seed) * (creature.type === 'fish' ? 0.08 : 0.035),
        depth,
        time,
    };
}

function createParticleBuffer(gl, count, mode) {
    const data = new Float32Array(count * 5);
    for (let i = 0; i < count; i += 1) {
        const offset = i * 5;
        const depth = 0.7 + Math.random() * (mode === 1 ? 5.5 : 7.2);
        data[offset] = (Math.random() * 2 - 1) * depth * 1.5;
        data[offset + 1] = (Math.random() * 2 - 1) * depth;
        data[offset + 2] = depth;
        data[offset + 3] = Math.random() * 1000;
        data[offset + 4] = Math.random();
    }
    return createStaticBuffer(gl, data);
}

function createFishVertices() {
    const vertices = [0.72, 0, 0.48, 0.16];
    for (let i = 0; i <= 20; i += 1) {
        const angle = (i / 20) * Math.PI * 2;
        const x = Math.cos(angle) * 0.46 - 0.08;
        const y = Math.sin(angle) * 0.105 * (1 - Math.max(0, Math.cos(angle)) * 0.22);
        vertices.push(x, y);
    }
    vertices.push(-0.48, 0, -0.78, 0.19, -0.69, 0, -0.78, -0.19, -0.48, 0, 0.48, -0.16);
    return new Float32Array(vertices);
}

function createJellyBellVertices() {
    const vertices = [0, -0.02];
    for (let i = 0; i <= 28; i += 1) {
        const angle = Math.PI - (i / 28) * Math.PI;
        vertices.push(Math.cos(angle) * 0.48, Math.sin(angle) * 0.34 - 0.03);
    }
    vertices.push(0.38, -0.15, 0.12, -0.21, -0.12, -0.21, -0.38, -0.15);
    return new Float32Array(vertices);
}

function createEllipseVertices(segments, width, height) {
    const vertices = [0, 0];
    for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(angle) * width, Math.sin(angle) * height);
    }
    return new Float32Array(vertices);
}

function createStaticBuffer(gl, data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

function createDynamicBuffer(gl, floatCount) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, floatCount * 4, gl.DYNAMIC_DRAW);
    return buffer;
}

function bindFloatAttribute(gl, program, buffer, name, size, stride, offset) {
    const location = gl.getAttribLocation(program, name);
    if (location < 0) {
        return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
}

function bindInterleavedAttribute(gl, program, name, size, stride, offset) {
    const location = gl.getAttribLocation(program, name);
    if (location < 0) {
        return;
    }
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) || 'shader compile failed';
        gl.deleteShader(shader);
        throw new Error(info);
    }
    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program) || 'program link failed';
        gl.deleteProgram(program);
        throw new Error(info);
    }
    return program;
}

function setUniform1f(gl, program, name, value) {
    const location = gl.getUniformLocation(program, name);
    if (location) {
        gl.uniform1f(location, value);
    }
}

function setUniform2f(gl, program, name, x, y) {
    const location = gl.getUniformLocation(program, name);
    if (location) {
        gl.uniform2f(location, x, y);
    }
}

function setUniform4f(gl, program, name, x, y, z, w) {
    const location = gl.getUniformLocation(program, name);
    if (location) {
        gl.uniform4f(location, x, y, z, w);
    }
}

function readAlarmIntensity() {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue('--alarm-intensity');
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function bootDeepSea() {
    const canvas = document.getElementById('deepSeaCanvas');
    if (!canvas) {
        return;
    }

    try {
        const ambient = new DeepSeaAmbient(canvas);
        window.deepSeaAmbient = ambient;
        document.documentElement.classList.add('webgl-ready');
        ambient.start();
    } catch (error) {
        console.warn('Deep sea WebGL background disabled:', error);
        document.documentElement.classList.add('webgl-fallback');
    }
}

const BACKGROUND_VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const BACKGROUND_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uAlarm;
uniform float uAspect;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
    vec2 uv = vUv;
    vec3 top = vec3(0.015, 0.075, 0.13);
    vec3 mid = vec3(0.005, 0.022, 0.044);
    vec3 bottom = vec3(0.0015, 0.003, 0.009);
    vec3 color = mix(top, mid, smoothstep(0.0, 0.58, uv.y));
    color = mix(color, bottom, smoothstep(0.38, 1.0, uv.y));
    float upperLight = pow(max(0.0, 1.0 - distance(vec2(uv.x, uv.y * 1.55), vec2(0.48, -0.06))), 2.2);
    float shafts = 0.0;
    for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float center = 0.28 + fi * 0.16 + sin(uTime * 0.035 + fi) * 0.05;
        float ray = smoothstep(0.18, 0.0, abs(uv.x - center - uv.y * (0.06 + fi * 0.018)));
        shafts += ray * (1.0 - uv.y) * 0.08;
    }
    float water = noise(vec2(uv.x * uAspect * 2.2 + uTime * 0.018, uv.y * 2.5 - uTime * 0.012));
    float terrain = smoothstep(0.58, 0.94, uv.y + noise(vec2(uv.x * 3.3, 2.0 + uTime * 0.006)) * 0.16);
    color += vec3(0.02, 0.12, 0.18) * upperLight * 0.24;
    color += vec3(0.03, 0.16, 0.22) * shafts;
    color += vec3(0.0, 0.032, 0.044) * water * 0.18;
    color = mix(color, vec3(0.0, 0.005, 0.011), terrain * 0.48);
    color += vec3(0.065, 0.13, 0.16) * uAlarm * (0.08 + upperLight * 0.14);
    float vignette = smoothstep(0.92, 0.28, distance(uv, vec2(0.5, 0.5)));
    color *= 0.48 + vignette * 0.62;
    gl_FragColor = vec4(color, 1.0);
}
`;

const PARTICLE_VERTEX_SHADER = `
precision mediump float;
attribute vec3 aPosition;
attribute vec2 aSeed;
uniform float uTime;
uniform float uAspect;
uniform float uPixelRatio;
uniform float uAlarm;
uniform float uMode;
varying float vSeed;
varying float vAlpha;
void main() {
    float depth = aPosition.z;
    float rise = uMode > 0.5 ? 0.015 : 0.035;
    float y = mod(aPosition.y + 1.2 * depth + uTime * rise * (0.35 + aSeed.y) + sin(uTime * 0.09 + aSeed.x) * 0.05, 2.4 * depth) - 1.2 * depth;
    float x = aPosition.x + sin(uTime * 0.055 + aSeed.x) * 0.16 * depth + sin(y * 0.8 + uTime * 0.035) * 0.04 * depth;
    vec2 projected = vec2(x / depth / max(0.85, uAspect), y / depth);
    gl_Position = vec4(projected, 0.0, 1.0);
    float baseSize = uMode > 0.5 ? 3.8 : 2.2;
    gl_PointSize = (baseSize + aSeed.y * 3.4 + uAlarm * 1.5) * uPixelRatio / depth;
    vSeed = aSeed.x;
    vAlpha = (uMode > 0.5 ? 0.28 : 0.16) * (0.45 + aSeed.y * 0.75) * (1.0 + uAlarm * 0.35);
}
`;

const PARTICLE_FRAGMENT_SHADER = `
precision mediump float;
varying float vSeed;
varying float vAlpha;
uniform float uMode;
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float core = smoothstep(0.5, 0.0, d);
    float sparkle = 0.65 + 0.35 * sin(vSeed);
    vec3 snow = vec3(0.62, 0.78, 0.88);
    vec3 glow = vec3(0.18, 0.92, 1.0);
    vec3 color = mix(snow, glow, step(0.5, uMode));
    gl_FragColor = vec4(color, core * vAlpha * sparkle);
}
`;

const CREATURE_VERTEX_SHADER = `
precision mediump float;
attribute vec2 aPosition;
uniform vec2 uCenter;
uniform vec2 uScale;
uniform float uRotation;
uniform float uAspect;
uniform float uDepth;
uniform float uTime;
void main() {
    float c = cos(uRotation);
    float s = sin(uRotation);
    vec2 local = aPosition;
    local.y += sin((aPosition.x + uTime * 0.55) * 5.0) * 0.018;
    vec2 p = vec2(local.x * c - local.y * s, local.x * s + local.y * c) * uScale;
    vec2 projected = uCenter + vec2(p.x / max(0.85, uAspect), p.y) / uDepth;
    gl_Position = vec4(projected, 0.0, 1.0);
}
`;

const CREATURE_FRAGMENT_SHADER = `
precision mediump float;
uniform vec4 uColor;
void main() {
    gl_FragColor = uColor;
}
`;

const LINE_VERTEX_SHADER = `
precision mediump float;
attribute vec2 aPosition;
uniform vec2 uCenter;
uniform vec2 uScale;
uniform float uRotation;
uniform float uAspect;
void main() {
    float c = cos(uRotation);
    float s = sin(uRotation);
    vec2 p = vec2(aPosition.x * c - aPosition.y * s, aPosition.x * s + aPosition.y * c) * uScale;
    gl_Position = vec4(uCenter + vec2(p.x / max(0.85, uAspect), p.y) * 0.55, 0.0, 1.0);
}
`;

const LINE_FRAGMENT_SHADER = `
precision mediump float;
uniform vec4 uColor;
void main() {
    gl_FragColor = uColor;
}
`;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDeepSea, { once: true });
} else {
    bootDeepSea();
}
