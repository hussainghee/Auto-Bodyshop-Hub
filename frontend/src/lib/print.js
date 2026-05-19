export function printDocument() {
  document.body.classList.add("printing-document");

  const cleanup = () => {
    document.body.classList.remove("printing-document");
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    window.print();

    // Fallback for browsers where afterprint is unreliable
    setTimeout(cleanup, 1200);
  }, 150);
}
