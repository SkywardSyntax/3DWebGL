import { useRef, useEffect, useState, useCallback } from 'react';
import { mat4, quat, vec3 } from 'gl-matrix';

function Home() {
  const canvasRef = useRef(null);
  const [rotationQuat, setRotationQuat] = useState(quat.create());
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showMesh, setShowMesh] = useState(false);
  const programInfoRef = useRef(null);
  const buffersRef = useRef(null);
  const glRef = useRef(null);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    canvasRef.current.style.cursor = "grabbing";
  }

  const handleMouseUp = () => {
    isDragging.current = false;
    canvasRef.current.style.cursor = "grab";
  }

  const handleMouseMove = useCallback((e) => {
    if (isDragging.current) {
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      const rotationAngle = Math.sqrt(deltaX * deltaX + deltaY * deltaY) * 0.01;
      const rotationAxis = vec3.fromValues(deltaY, deltaX, 0.0);
      vec3.normalize(rotationAxis, rotationAxis);

      const newQuat = quat.create();
      quat.setAxisAngle(newQuat, rotationAxis, rotationAngle);
      quat.multiply(newQuat, newQuat, rotationQuat);
      setRotationQuat(newQuat);
    }
  }, [rotationQuat]);

  const handleGestureStart = (e) => {
    e.preventDefault();
  };

  const handleGestureChange = (e) => {
    e.preventDefault();
    let newZoomLevel = zoomLevel * e.scale;
    newZoomLevel = Math.max(0.1, newZoomLevel); // Allow zooming out to 10% of the original size
    setZoomLevel(newZoomLevel);
  };

  const handleGestureEnd = (e) => {
    e.preventDefault();
  };

  const handleToggleMesh = () => {
    setShowMesh(!showMesh);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    glRef.current = gl;

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const programInfo = initProgramInfo(gl);
    buffersRef.current = initBuffers(gl);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, aspect, 0.1, 100.0);
    programInfo.projectionMatrix = projectionMatrix;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    programInfoRef.current = programInfo;
    drawScene();

    canvas.addEventListener('gesturestart', handleGestureStart);
    canvas.addEventListener('gesturechange', handleGestureChange);
    canvas.addEventListener('gestureend', handleGestureEnd);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('gesturestart', handleGestureStart);
      canvas.removeEventListener('gesturechange', handleGestureChange);
      canvas.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []);

  useEffect(() => {
    drawScene();
  }, [rotationQuat, zoomLevel, showMesh]);

  const drawScene = () => {
    const gl = glRef.current;
    if (!gl) return;

    const programInfo = programInfoRef.current;
    const buffers = buffersRef.current;
    if (!programInfo || !buffers) return;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -6.0]);
    const rotationMatrix = mat4.create();
    mat4.fromQuat(rotationMatrix, rotationQuat);
    mat4.multiply(modelViewMatrix, modelViewMatrix, rotationMatrix);

    const projectionMatrix = mat4.clone(programInfo.projectionMatrix);
    mat4.scale(projectionMatrix, projectionMatrix, [zoomLevel, zoomLevel, 1.0]);

    drawSceneInternal(gl, programInfo, buffers, modelViewMatrix, projectionMatrix, showMesh);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ width: '100vw', height: '100vh', cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      ></canvas>
      <button onClick={handleToggleMesh} style={{ position: 'absolute', top: '10px', left: '10px' }}>
        Toggle Mesh
      </button>
    </>
  );
}

function initProgramInfo(gl) {
  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;
    uniform vec3 uLightPosition;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientLight;
    varying highp vec3 vLighting;
    varying highp vec3 vNormal;
    varying highp vec3 vPosition;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vNormal = mat3(uNormalMatrix) * aVertexNormal;
      vPosition = vec3(uModelViewMatrix * aVertexPosition);
      highp vec3 ambient = uAmbientLight;
      highp vec3 lightDirection = normalize(uLightPosition - vPosition);
      highp float diffuse = max(dot(vNormal, lightDirection), 0.0);
      highp vec3 reflectDir = reflect(-lightDirection, vNormal);
      highp vec3 viewDir = normalize(-vPosition);
      highp float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
      vLighting = ambient + (uLightColor * diffuse) + (uLightColor * specular);
    }
  `;

  const fsSource = `
    varying highp vec3 vLighting;
    void main(void) {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      gl_FragColor.rgb *= vLighting;
    }
  `;

  const fsSourceEdges = `
    void main(void) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  const fsSourceMesh = `
    void main(void) {
      gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    }
  `;

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  const edgeShaderProgram = initShaderProgram(gl, vsSource, fsSourceEdges);
  const meshShaderProgram = initShaderProgram(gl, vsSource, fsSourceMesh);
  return {
    program: shaderProgram,
    edgeProgram: edgeShaderProgram,
    meshProgram: meshShaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      vertexNormal: gl.getAttribLocation(shaderProgram, 'aVertexNormal'),
    },
    edgeAttribLocations: {
      vertexPosition: gl.getAttribLocation(edgeShaderProgram, 'aVertexPosition'),
    },
    meshAttribLocations: {
      vertexPosition: gl.getAttribLocation(meshShaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      normalMatrix: gl.getUniformLocation(shaderProgram, 'uNormalMatrix'),
      lightPosition: gl.getUniformLocation(shaderProgram, 'uLightPosition'),
      lightColor: gl.getUniformLocation(shaderProgram, 'uLightColor'),
      ambientLight: gl.getUniformLocation(shaderProgram, 'uAmbientLight'),
    },
    edgeUniformLocations: {
      projectionMatrix: gl.getUniformLocation(edgeShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(edgeShaderProgram, 'uModelViewMatrix'),
    },
    meshUniformLocations: {
      projectionMatrix: gl.getUniformLocation(meshShaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(meshShaderProgram, 'uModelViewMatrix'),
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
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [
    -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
    -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
    -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
    1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0,
    -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

  const vertexNormals = [
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);

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
    normal: normalBuffer,
    indices: indexBuffer,
    edgeIndices: edgeIndexBuffer,
  };
}

function drawSceneInternal(gl, programInfo, buffers, modelViewMatrix, projectionMatrix, showMesh) {
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

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexNormal,
      numComponents,
      type,
      normalize,
      stride,
      offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.useProgram(programInfo.program);
  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);

  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelViewMatrix);
  mat4.transpose(normalMatrix, normalMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

  gl.uniform3fv(programInfo.uniformLocations.lightPosition, [5.0, 5.0, 5.0]);
  gl.uniform3fv(programInfo.uniformLocations.lightColor, [1.0, 1.0, 1.0]);
  gl.uniform3fv(programInfo.uniformLocations.ambientLight, [0.3, 0.3, 0.3]);

  {
    const vertexCount = 36;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

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

  if (showMesh) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.useProgram(programInfo.meshProgram);
    gl.uniformMatrix4fv(programInfo.meshUniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.meshUniformLocations.modelViewMatrix, false, modelViewMatrix);
    {
      const vertexCount = 36;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.drawElements(gl.LINES, vertexCount, type, offset);
    }
  }
}

export default Home;
