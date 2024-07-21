# WebGL 3D Cube

This repository contains a simple WebGL application that renders a 3D cube on a black background. The cube is red.

## Getting Started

To run this application:

1. Install dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000` to see the 3D cube.

4. Use the trackpad to zoom in and out:
   - Pinch outward to zoom in.
   - Pinch inward to zoom out.
   - The zooming out limit is set to 10% of the cube's original size.
   - The zoom level will now smoothly transition without abrupt resets when zooming out multiple times.

## Project Structure

- `pages/index.js`: Contains the WebGL code for rendering the 3D cube.
- `global.css`: Contains global styles for the application, including setting the background color to black.

## Dependencies

- `next`: ^14.1.1
- `react`: ^18.2.0
- `react-dom`: ^18.2.0

## Using the Slider

A slider UI component has been added to control the rotation of the cube. You can use the slider at the bottom of the screen to rotate the cube along the Y-axis.

## Frustum Culling Optimization

This project includes an optimization technique called frustum culling to avoid rendering parts of the cube that are not visible. Frustum culling improves performance by skipping the rendering of faces of the cube that are outside the view frustum.

### Benefits of Frustum Culling

- **Improved Performance**: By not rendering faces that are not visible, the application can run more efficiently and smoothly.
- **Reduced GPU Load**: Frustum culling reduces the number of draw calls and the amount of work the GPU has to do, leading to better overall performance.

### How to Use

The frustum culling optimization is automatically applied when rendering the cube. No additional configuration is required. Simply run the application as described in the "Getting Started" section, and the optimization will be in effect.

## Caching Mechanisms for Optimization

This project also includes caching mechanisms to further optimize performance by reducing redundant computations.

### Caching Mechanisms Introduced

- **Transformation Matrices**: The transformation matrices are cached to avoid redundant computations in the `drawScene` function.
- **Transformed Positions**: The results of `calculateTransformedPositions` are cached and reused if the model view matrix has not changed.
- **Frustum Planes**: The results of `computeFrustumPlanes` are cached and reused if the projection or model view matrix has not changed.

### Benefits of Caching

- **Reduced CPU Load**: By caching and reusing previously computed values, the CPU load is significantly reduced.
- **Improved Performance**: Caching helps in avoiding redundant computations, leading to smoother and more efficient rendering.

## Lighting and Shadows

This project now includes a fixed light source with visible source, and shadows and highlights are added to the webpage. The light source is a point light and is white in color. The shaders use Phong shading to calculate the lighting effects.

### Light Source and Shadows

The light source is fixed and positioned in the scene. The vertex shader includes normal vectors and calculates lighting effects based on the light source. The fragment shader calculates the final color of the cube based on the lighting effects, including shadows and highlights.

### Adjusting Light Source

To adjust the light source position and color, you can modify the relevant code in `pages/index.js`. Look for the light position and color definitions in the `initProgramInfo` function and update them as needed.

## Enhanced Lighting and Shadows

This project now includes enhanced lighting and shadows using Phong shading, shadow mapping, and multiple light sources. The shaders have been updated to provide more realistic lighting effects.

### Phong Shading

The shaders now use Phong shading to calculate lighting effects. This includes ambient, diffuse, and specular components for more realistic lighting.

### Shadow Mapping

Shadow mapping has been implemented to add realistic shadows to the scene. Depth textures are used for shadow casting.

### Multiple Light Sources

The scene now supports multiple light sources, including point lights and spotlights. This allows for more complex and realistic lighting setups.

### Adjusting Light Properties

To adjust the light properties, such as position, color, and type, you can modify the relevant code in `pages/index.js`. Look for the light definitions in the `initProgramInfo` function and update them as needed.

## Advanced Shadow Mapping Techniques

This project now includes advanced shadow mapping techniques to create more realistic shadows. The shadow mapping technique used is Percentage Closer Filtering (PCF), which helps to smooth out the edges of the shadows and reduce aliasing artifacts.

### Shadow Calculations

The vertex and fragment shaders have been updated to include shadow calculations. The vertex shader calculates the shadow coordinates, and the fragment shader uses these coordinates to determine the shadow intensity using the shadow map.

### Directional Light Source

The light source has been updated to a directional light with adjustable properties. The properties of the light source, such as direction and color, can be adjusted in the `initProgramInfo` function in `pages/index.js`.

### Adjusting Light Source Properties

To adjust the light source properties, such as direction and color, you can modify the relevant code in `pages/index.js`. Look for the light direction and color definitions in the `initProgramInfo` function and update them as needed.

### Viewing Realistic Shadows

To see the realistic shadows in action, run the application as described in the "Getting Started" section. The shadows should now appear smoother and more realistic due to the advanced shadow mapping techniques.

## Viewing the Triangle Mesh

A new button has been added to the UI to toggle the visibility of the triangle mesh for the cube. The button is labeled "Toggle Mesh".

### How to Use

1. Run the application as described in the "Getting Started" section.
2. Click the "Toggle Mesh" button located at the top-left corner of the screen to toggle the visibility of the triangle mesh for the cube.

## WebGL2 Compatibility

This project now uses WebGL2 for rendering the 3D cube. WebGL2 provides additional features and improved performance compared to WebGL1. Ensure that you are using a WebGL2-compatible browser to run this application.
