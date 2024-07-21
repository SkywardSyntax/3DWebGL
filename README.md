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
