export function printDocument() {
  document.body.classList.add("printing-document");

  setTimeout(() => {
    window.print();

    setTimeout(() => {
      document.body.classList.remove("printing-document");
    }, 700);
  }, 100);
}
