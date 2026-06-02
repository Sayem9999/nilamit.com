import { jsPDF } from 'jspdf';
import { formatBDT } from './format';

/**
 * jsPDF's built-in Helvetica (standard-14 PDF fonts) has no glyph for the
 * Bengali Taka sign ৳ (U+09F3) — it renders as a blank/garbled box. For the
 * PDF we swap the symbol for an ASCII "BDT" prefix so amounts are legible.
 */
function formatBDTForPdf(amount: number): string {
  return formatBDT(amount).replace('৳', 'BDT ');
}

interface InvoiceData {
  invoiceNumber: string;
  date: Date;
  auctionTitle: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
}

export function generateInvoice(data: InvoiceData) {
  const doc = new jsPDF();
  const margin = 20;
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(0, 102, 204); // Nilamit Blue
  doc.text("NILAMIT", margin, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Bangladesh's Premier Auction Platform", margin, 38);
  
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("OFFICIAL INVOICE", 140, 30);
  
  doc.setFontSize(10);
  doc.text(`Invoice #: ${data.invoiceNumber}`, 140, 38);
  doc.text(`Date: ${data.date.toLocaleDateString()}`, 140, 44);
  
  // Divider
  doc.setDrawColor(240);
  doc.line(margin, 55, 190, 55);
  
  // Buyer & Seller Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", margin, 70);
  doc.text("SHIP FROM", 110, 70);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.buyerName, margin, 78);
  doc.text(data.buyerEmail, margin, 84);
  
  doc.text(data.sellerName, 110, 78);
  doc.text(data.sellerEmail, 110, 84);
  
  // Item Table
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, 100, 170, 10, 'F');
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPTION", margin + 5, 106);
  doc.text("TOTAL", 160, 106);
  
  doc.setFont("helvetica", "normal");
  doc.text(data.auctionTitle, margin + 5, 120);
  doc.text(formatBDTForPdf(data.amount), 160, 120);
  
  // Footer
  doc.setDrawColor(240);
  doc.line(margin, 150, 190, 150);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("This is a computer generated invoice and does not require a physical signature.", margin, 160);
  doc.text("Nilamit Platform - Secure Auctions, Reliable Deliveries.", margin, 166);
  
  return doc;
}
