import { useRef, useEffect, useState } from 'react';
import { mat4, vec3 } from 'gl-matrix';

function Home() {
  const canvasRef = useRef(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const programInfoRef = useRef(null); // Cache shader program info
  const buffersRef = useRef(null); // Cache buffers
  const glRef = useRef(null); // Cache WebGL context

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    glRef.current = gl; // Cache WebGL context

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Initialize shaders, buffers, etc.
    const programInfo = initProgramInfo(gl);
    buffersRef.current = initBuffers(gl);

    // Cache projection matrix
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);
    programInfo.projectionMatrix = projectionMatrix;

    // Resize handling
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    programInfoRef.current = programInfo;
    drawScene(); // Initial draw

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    drawScene(); // Redraw on rotation change
  }, [rotationAngle]);

  const drawScene = () => {
    const gl = glRef.current;
    if (!gl) return;

    const programInfo = programInfoRef.current;
    const buffers = buffersRef.current;
    if (!programInfo || !buffers) return;

    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Calculate model-view matrix
    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, Math.PI / 4, [0, 1, 0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, Math.atan(Math.sqrt(2)), [1, 0, -1]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, rotationAngle * Math.PI / 180, [0, 1, 0]);
    
    // Draw the scene
    drawSceneInternal(gl, programInfo, buffers, modelViewMatrix);
  };

  return (
    <>
      <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh' }}></canvas>
      <div className="slider">
        <input
          type="range"
          min="0"
          max="360"
          value={rotationAngle}
          onChange={(e) => setRotationAngle(e.target.value)}
        />
      </div>
    </>
  );
}

function initProgramInfo(gl) {
  const vsSource = `
    attribute vec4 aVertexPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
    }
  `;

  const fsSource = `
    void main(void) {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red color
    }
  `;

  const fsSourceEdges = `
    void main(void) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White color for edges
    }
  `;

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  const edgeShaderProgram = initShaderProgram(gl, vsSource, fsSourceEdges);

  return {
    program: shaderProgram,
    edgeProgram: edgeShaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    edgeAttribLocations: {
      vertexPosition: gl.getAttribLocation(edgeShaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
    },
    edgeUniformLocations: {
      projectionMatrix: gl.getUniformLocation(edgeShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(edgeShaderProgram, 'uModelViewMatrix'),
    },
  };
}

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }
  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initBuffers(gl) {
  // Create a buffer for the cube's vertex positions.
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Define the positions for each vertex of the cube.
  const positions = [
    -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
    -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
  ];

  // Assign positions to buffer.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Element buffer for the indices of the cube's faces.
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  const indices = [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ];

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  const edgeIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);

  const edgeIndices = [
    0, 1, 1, 2, 2, 3, 3, 0,
    4, 5, 5, 6, 6, 7, 7, 4,
    0, 4, 1, 5, 2, 6, 3, 7,
  ];

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(edgeIndices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    indices: indexBuffer,
    edgeIndices: edgeIndexBuffer,
  };
}

function drawSceneInternal(gl, programInfo, buffers, modelViewMatrix) {
  const { projectionMatrix } = programInfo;

  // Vertex positions
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  // Element array for faces
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

  // Use shader program
  gl.useProgram(programInfo.program);

  // Set shader uniforms
  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

  // Draw the cube faces
  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

  // Draw edges
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.edgeIndices);
  gl.useProgram(programInfo.edgeProgram);
  gl.uniformMatrix4fv(programInfo.edgeUniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.edgeUniformLocations.modelViewMatrix, false, modelViewMatrix);

  {
    const edgeVertexCount = 24;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.LINES, edgeVertexCount, type, offset);
  }
}

export default Home;