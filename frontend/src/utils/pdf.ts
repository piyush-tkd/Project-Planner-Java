/**
 * PDF export utility — uses the browser's native print-to-PDF dialog.
 * The global.css @media print rules hide all UI chrome (nav, buttons, filters)
 * so only the page content is captured.
 *
 * Usage:
 *   exportToPdf('Executive Summary')
 */
export function exportToPdf(reportTitle: string): void {
  const previousTitle = document.title;
  // Set document title so the browser uses it as the suggested filename
  document.title = `${reportTitle} — Portfolio Planner — ${new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })}`;

  // Mark the body so the @media print CSS can target .pp-pdf-printing if needed
  document.body.classList.add('pp-pdf-printing');

  const afterPrint = () => {
    document.title = previousTitle;
    document.body.classList.remove('pp-pdf-printing');
    window.removeEventListener('afterprint', afterPrint);
  };

  window.addEventListener('afterprint', afterPrint);
  window.print();
}
