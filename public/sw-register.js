if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(
      function () {
        console.log('SW registered');
      },
      function (err) {
        console.log('SW failed: ', err);
      }
    );
  });
}
