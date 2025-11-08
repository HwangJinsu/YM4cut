# GEMINI.md

## Project Overview

This project is a "Life4Cut" style photo booth application for Windows 10/11. The application will control a USB camera and a printer to take 4 consecutive photos, composite them onto a template, and print the result.

The project can be implemented using either of the following technology stacks:

*   **Electron/React:**
    *   Electron for the desktop application framework.
    *   React for the user interface.
    *   Redux Toolkit for state management.
    *   Sharp for image processing.
    *   `node-printer` for printer control.
*   **Python/PyQt6:**
    *   PyQt6 for the user interface.
    *   OpenCV for camera control and image processing.
    *   Pillow for image processing.
    *   `pywin32` for printer control.

The application will feature a touch-screen-friendly UI, automatic photo capture, image compositing, and printing.

## Building and Running

**TODO:** Please fill in the actual commands for building, running, and testing the project once the initial project structure is set up.

### Electron/React

```bash
# Install dependencies
npm install

# Run the application in development mode
npm start

# Build the application for production
npm run build

# Run the tests
npm test
```

### Python/PyQt6

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python main.py

# Run the tests
pytest
```

## Development Conventions

### Code Structure

*   The codebase should follow a modular architecture, with a clear separation of concerns between the UI, business logic, and hardware control layers.
*   Configuration should be stored in a `config/settings.json` file, allowing for easy modification without changing the code.

### Logging

*   All major events and errors should be logged to a file.
*   Log files should be rotated daily.

### Testing

*   Unit tests should be written for all new features, with a target of 80% code coverage.
*   Integration tests should be written to test the entire workflow, from photo capture to printing.
*   The following test frameworks should be used:
    *   **Electron/React:** Jest and React Testing Library.
    *   **Python/PyQt6:** pytest.
