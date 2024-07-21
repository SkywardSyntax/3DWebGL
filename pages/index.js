import { useRef, useEffect, useState } from 'react';
import { mat4, vec3 } from 'gl-matrix';

function Home() {
  const canvasRef = useRef(null);
  const [rotationAngle, setRotationAngle] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Vertex shader program
    const vsSource = `
      attribute vec4 aVertexPosition;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      }
    `;

    // Fragment shader program
    const fsSource = `
      void main(void) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red color
      }
    `;

    // Fragment shader program for edges
    const fsSourceEdges = `
      void main(void) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White color for edges
      }
    `;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const edgeShaderProgram = initShaderProgram(gl, vsSource, fsSourceEdges);

    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      },
    };

    const edgeProgramInfo = {
      program: edgeShaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(edgeShaderProgram, 'aVertexPosition'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(edgeShaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(edgeShaderProgram, 'uModelViewMatrix'),
      },
    };

    const buffers = initBuffers(gl);

    const draw = () => {
      drawScene(gl, programInfo, edgeProgramInfo, buffers, rotationAngle);
      requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };

  }, [rotationAngle]);

  return (
    <>
      <canvas ref={canvasRef} 
              style={{ width: '100vw', height: '100vh' }}></canvas>
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
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [
    // Front face
    -1.0, -1.0, 1.0,
    1.0, -1.0, 1.0,
    1.0, 1.0, 1.0,
    -1.0, 1.0, 1.0,

    // Back face
    -1.0, -1.0, -1.0,
    -1.0, 1.0, -1.0,
    1.0, 1.0, -1.0,
    1.0, -1.0, -1.0,

    // Top face
    -1.0, 1.0, -1.0,
    -1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,
    1.0, 1.0, -1.0,

    // Bottom face
    -1.0, -1.0, -1.0,
    1.0, -1.0, -1.0,
    1.0, -1.0, 1.0,
    -1.0, -1.0, 1.0,

    // Right face
    1.0, -1.0, -1.0,
    1.0, 1.0, -1.0,
    1.0, 1.0, 1.0,
    1.0, -1.0, 1.0,

    // Left face
    -1.0, -1.0, -1.0,
    -1.0, -1.0, 1.0,
    -1.0, 1.0, 1.0,
    -1.0, 1.0, -1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array(positions),
    gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  const indices = [
    0, 1, 2, 0, 2, 3,    // front
    4, 5, 6, 4, 6, 7,    // back
    8, 9, 10, 8, 10, 11, // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
  ];

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices), gl.STATIC_DRAW);

  const edgeIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);

  const edgeIndices = [
    0, 1, 1, 2, 2, 3, 3, 0, // front edges
    4, 5, 5, 6, 6, 7, 7, 4, // back edges
    0, 4, 1, 5, 2, 6, 3, 7  // connecting edges
  ];

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(edgeIndices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    indices: indexBuffer,
    edgeIndices: edgeIndexBuffer,
  };
}

function drawScene(gl, programInfo, edgeProgramInfo, buffers, rotationAngle) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  mat4.perspective(projectionMatrix,
    fieldOfView,
    aspect,
    zNear,
    zFar);

  const modelViewMatrix = mat4.create();

  mat4.translate(modelViewMatrix,     // destination matrix
    modelViewMatrix,     // matrix to translate
    [-0.0, 0.0, -6.0]);  // amount to translate

  // Rotate to achieve isometric view
  mat4.rotate(modelViewMatrix, modelViewMatrix, Math.PI / 4, [0, 1, 0]);
  mat4.rotate(modelViewMatrix, modelViewMatrix, Math.atan(Math.sqrt(2)), [1, 0, -1]);

  // Apply rotation from slider
  mat4.rotate(modelViewMatrix, modelViewMatrix, rotationAngle * Math.PI / 180, [0, 1, 0]);

  const frustumPlanes = computeFrustumPlanes(projectionMatrix, modelViewMatrix);

  const faces = [
    { vertices: [0, 1, 2, 3], visible: false },
    { vertices: [4, 5, 6, 7], visible: false },
    { vertices: [8, 9, 10, 11], visible: false },
    { vertices: [12, 13, 14, 15], visible: false },
    { vertices: [16, 17, 18, 19], visible: false },
    { vertices: [20, 21, 22, 23], visible: false },
  ];

  const transformedPositions = calculateTransformedPositions(buffers.position, modelViewMatrix);

  for (let face of faces) {
    face.visible = isFaceVisible(face.vertices, transformedPositions, frustumPlanes);
  }

  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      numComponents,
      type,
      normalize,
      stride,
      offset);
    gl.enableVertexAttribArray(
      programInfo.attribLocations.vertexPosition);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(
    programInfo.uniformLocations.projectionMatrix,
    false,
    projectionMatrix);
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.modelViewMatrix,
    false,
    modelViewMatrix);

  for (let i = 0; i < faces.length; i++) {
    if (faces[i].visible) {
      const offset = i * 6 * 2;
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, offset);
    }
  }

  // Draw edges
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.edgeIndices);
  gl.useProgram(edgeProgramInfo.program);
  gl.uniformMatrix4fv(
    edgeProgramInfo.uniformLocations.projectionMatrix,
    false,
    projectionMatrix);
  gl.uniformMatrix4fv(
    edgeProgramInfo.uniformLocations.modelViewMatrix,
    false,
    modelViewMatrix);
  gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);
}

function computeFrustumPlanes(projectionMatrix, modelViewMatrix) {
  const combinedMatrix = mat4.create();
  mat4.multiply(combinedMatrix, projectionMatrix, modelViewMatrix);

  const planes = [];
  for (let i = 0; i < 6; i++) {
    planes.push(vec3.create());
  }

  // Left plane
  planes[0][0] = combinedMatrix[3] + combinedMatrix[0];
  planes[0][1] = combinedMatrix[7] + combinedMatrix[4];
  planes[0][2] = combinedMatrix[11] + combinedMatrix[8];
  planes[0][3] = combinedMatrix[15] + combinedMatrix[12];

  // Right plane
  planes[1][0] = combinedMatrix[3] - combinedMatrix[0];
  planes[1][1] = combinedMatrix[7] - combinedMatrix[4];
  planes[1][2] = combinedMatrix[11] - combinedMatrix[8];
  planes[1][3] = combinedMatrix[15] - combinedMatrix[12];

  // Bottom plane
  planes[2][0] = combinedMatrix[3] + combinedMatrix[1];
  planes[2][1] = combinedMatrix[7] + combinedMatrix[5];
  planes[2][2] = combinedMatrix[11] + combinedMatrix[9];
  planes[2][3] = combinedMatrix[15] + combinedMatrix[13];

  // Top plane
  planes[3][0] = combinedMatrix[3] - combinedMatrix[1];
  planes[3][1] = combinedMatrix[7] - combinedMatrix[5];
  planes[3][2] = combinedMatrix[11] - combinedMatrix[9];
  planes[3][3] = combinedMatrix[15] - combinedMatrix[13];

  // Near plane
  planes[4][0] = combinedMatrix[3] + combinedMatrix[2];
  planes[4][1] = combinedMatrix[7] + combinedMatrix[6];
  planes[4][2] = combinedMatrix[11] + combinedMatrix[10];
  planes[4][3] = combinedMatrix[15] + combinedMatrix[14];

  // Far plane
  planes[5][0] = combinedMatrix[3] - combinedMatrix[2];
  planes[5][1] = combinedMatrix[7] - combinedMatrix[6];
  planes[5][2] = combinedMatrix[11] - combinedMatrix[10];
  planes[5][3] = combinedMatrix[15] - combinedMatrix[14];

  for (let i = 0; i < 6; i++) {
    const length = Math.sqrt(planes[i][0] * planes[i][0] + planes[i][1] * planes[i][1] + planes[i][2] * planes[i][2]);
    planes[i][0] /= length;
    planes[i][1] /= length;
    planes[i][2] /= length;
    planes[i][3] /= length;
  }

  return planes;
}

function calculateTransformedPositions(positionBuffer, modelViewMatrix) {
  const positions = new Float32Array(positionBuffer);
  const transformedPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const vertex = vec3.fromValues(positions[i], positions[i + 1], positions[i + 2]);
    vec3.transformMat4(vertex, vertex, modelViewMatrix);
    transformedPositions[i] = vertex[0];
    transformedPositions[i + 1] = vertex[1];
    transformedPositions[i + 2] = vertex[2];
  }

  return transformedPositions;
}

function isFaceVisible(vertices, transformedPositions, frustumPlanes) {
  for (let i = 0; i < vertices.length; i++) {
    const x = transformedPositions[vertices[i] * 3];
    const y = transformedPositions[vertices[i] * 3 + 1];
    const z = transformedPositions[vertices[i] * 3 + 2];
    if (isPointInFrustum(x, y, z, frustumPlanes)) {
      return true;
    }
  }
  return false;
}

function isPointInFrustum(x, y, z, frustumPlanes) {
  for (let i = 0; i < 6; i++) {
    if (frustumPlanes[i][0] * x + frustumPlanes[i][1] * y + frustumPlanes[i][2] * z + frustumPlanes[i][3] <= 0) {
      return false;
    }
  }
  return true;
}

export default Home;
