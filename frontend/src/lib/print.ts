"use client";

export function printThermalReceipt() {
  if (typeof window === "undefined") return;
  document.body.classList.add("printing-thermal");

  const cleanup = () => {
    document.body.classList.remove("printing-thermal");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 2500);
  }, 150);
}

export function printBusinessReport() {
  if (typeof window === "undefined") return;
  document.body.classList.remove("printing-thermal");
  setTimeout(() => {
    window.print();
  }, 80);
}
