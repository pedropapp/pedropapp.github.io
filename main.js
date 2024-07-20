// Initialize AOS
AOS.init();

// Wait for the Spline viewer to be defined
window.addEventListener('load', () => {
    const viewer = document.getElementById('spline-viewer');
    
    if (viewer) {
      // Ensure the viewer takes up the full height and width of its container
      viewer.style.width = '100%';
      viewer.style.height = '100%';
      viewer.style.position = 'absolute';
      viewer.style.top = '0';
      viewer.style.left = '0';
      viewer.style.zIndex = '-1';
    }
  });
