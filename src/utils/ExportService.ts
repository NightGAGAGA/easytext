import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { asBlob } from 'html-docx-js-typescript';

export type ExportFormat = 'txt' | 'pdf' | 'doc' | 'docx';

export class ExportService {
  static getFileName(fileName: string, format: ExportFormat): string {
    const base = fileName.replace(/\.[^/.]+$/, '');
    const extensions: Record<ExportFormat, string> = {
      txt: '.txt',
      pdf: '.pdf',
      doc: '.doc',
      docx: '.docx',
    };
    return `${base}${extensions[format]}`;
  }

  static downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || '';
  }

  static exportTxt(content: string, fileName: string): void {
    const text = this.stripHtml(content);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    this.downloadBlob(blob, this.getFileName(fileName, 'txt'));
  }

  static async exportPdf(content: string, fileName: string): Promise<void> {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; font-size: 16px; line-height: 1.8; color: #000; background: #fff; width: 210mm;">
        ${content}
      </div>
    `;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      pdf.save(this.getFileName(fileName, 'pdf'));
    } finally {
      document.body.removeChild(container);
    }
  }

  static exportDoc(content: string, fileName: string): void {
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${fileName}</title></head>
      <body>
        ${content}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword;charset=utf-8',
    });
    this.downloadBlob(blob, this.getFileName(fileName, 'doc'));
  }

  static async exportDocx(content: string, fileName: string): Promise<void> {
    const html = `
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; font-size: 16px; line-height: 1.8;">
          ${content}
        </body>
      </html>
    `;
    const blob = await asBlob(html, {
      orientation: 'portrait',
      margins: { top: 720, right: 720, bottom: 720, left: 720 },
    });
    this.downloadBlob(blob as Blob, this.getFileName(fileName, 'docx'));
  }

  static async export(
    format: ExportFormat,
    content: string,
    fileName: string
  ): Promise<void> {
    switch (format) {
      case 'txt':
        this.exportTxt(content, fileName);
        break;
      case 'pdf':
        await this.exportPdf(content, fileName);
        break;
      case 'doc':
        this.exportDoc(content, fileName);
        break;
      case 'docx':
        await this.exportDocx(content, fileName);
        break;
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
    // 记录导出时间
    localStorage.setItem('easyText_lastExportTime', String(Date.now()));
  }
}
