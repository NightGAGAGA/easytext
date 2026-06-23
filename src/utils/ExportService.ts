import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export type ExportFormat = 'txt' | 'pdf' | 'doc' | 'docx';

export class ExportService {
  static getExtension(format: ExportFormat): string {
    const extensions: Record<ExportFormat, string> = {
      txt: '.txt',
      pdf: '.pdf',
      doc: '.doc',
      docx: '.docx',
    };
    return extensions[format];
  }

  static getFileName(fileName: string, format: ExportFormat): string {
    const base = fileName.replace(/\.[^/.]+$/, '');
    return `${base}${this.getExtension(format)}`;
  }

  /**
   * 提取基础名和版本号
   */
  static extractBaseAndVersion(name: string): { base: string; version: number } {
    const match = name.match(/^(.*)\((\d+)\)$/);
    if (match) {
      return { base: match[1].trim(), version: parseInt(match[2], 10) };
    }
    return { base: name.trim(), version: 0 };
  }

  /**
   * 获取建议文件名
   */
  static async getSuggestedFileName(
    fileName: string,
    format: ExportFormat
  ): Promise<string> {
    const fullName = this.getFileName(fileName, format);
    const ext = fullName.includes('.') ? fullName.slice(fullName.lastIndexOf('.')) : '';
    const nameWithoutExt = ext ? fullName.slice(0, fullName.lastIndexOf('.')) : fullName;
    const { base } = this.extractBaseAndVersion(nameWithoutExt);

    const isNative = Capacitor.isNativePlatform();
    if (!isNative) {
      return fullName;
    }

    try {
      const result = await Filesystem.readdir({
        path: 'EasyText',
        directory: Directory.Documents,
      });
      const existingFiles = result.files.map((f: any) => f.name || f);

      let maxVersion = 0;
      for (const file of existingFiles) {
        const fileExt = file.includes('.') ? file.slice(file.lastIndexOf('.')) : '';
        const fileNameNoExt = fileExt ? file.slice(0, file.lastIndexOf('.')) : file;
        const { base: fileBase, version: fileVersion } = this.extractBaseAndVersion(fileNameNoExt);
        if (fileBase === base && fileVersion > maxVersion) {
          maxVersion = fileVersion;
        }
      }

      const { version: currentVersion } = this.extractBaseAndVersion(nameWithoutExt);
      const nextVersion = Math.max(maxVersion, currentVersion) + 1;
      return `${base}(${nextVersion})${ext}`;
    } catch {
      return fullName;
    }
  }

  static getLastExportPath(): string {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      return 'Documents/EasyText/';
    }
    try {
      const saved = localStorage.getItem('easyText_lastExportPath');
      if (saved) return saved;
    } catch { /* ignore */ }
    return '本地文件夹';
  }

  static setLastExportPath(path: string): void {
    try {
      localStorage.setItem('easyText_lastExportPath', path);
    } catch { /* ignore */ }
  }

  static async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  static async readFileAsText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob, 'utf-8');
    });
  }

  static async downloadBlob(blob: Blob, fileName: string, customPath?: string): Promise<void> {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      await this.saveFileNative(blob, fileName, customPath);
    } else if ('showSaveFilePicker' in window) {
      await this.saveFileWithPicker(blob, fileName);
    } else {
      this.downloadBlobLegacy(blob, fileName);
    }
  }

  static downloadBlobLegacy(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async saveFileWithPicker(blob: Blob, fileName: string): Promise<void> {
    const picker = (window as any).showSaveFilePicker;
    const handle = await picker({
      suggestedName: fileName,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  static async saveFileNative(blob: Blob, fileName: string, customPath?: string): Promise<void> {
    try {
      const arrayBuffer = await this.blobToArrayBuffer(blob);
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      // 如果用户选择了自定义路径，尝试直接写入（目录已存在，readdir 已证明）
      if (customPath) {
        try {
          // 尝试1：直接写入，不创建目录（假设目录已存在）
          await Filesystem.writeFile({
            path: `${customPath}/${fileName}`,
            data: base64,
            directory: Directory.ExternalStorage,
          });
          console.log('直接写入成功:', customPath);
          return;
        } catch (e1: any) {
          console.error('直接写入失败:', e1.message);
          
          // 尝试2：使用 recursive 创建目录后写入
          try {
            await Filesystem.writeFile({
              path: `${customPath}/${fileName}`,
              data: base64,
              directory: Directory.ExternalStorage,
              recursive: true,
            });
            console.log('recursive 写入成功:', customPath);
            return;
          } catch (e2: any) {
            console.error('recursive 写入失败:', e2.message);
          }
        }
      }

      // 回退到默认路径：Documents/EasyText/
      try {
        await Filesystem.writeFile({
          path: `EasyText/${fileName}`,
          data: base64,
          directory: Directory.Documents,
          recursive: true,
        });
        console.log('回退到默认路径写入成功');
      } catch (e3: any) {
        console.error('默认路径写入失败:', e3.message);
        throw new Error('保存文件失败：' + (e3.message || '未知错误'));
      }
    } catch (error: any) {
      console.error('保存文件失败:', error);
      throw new Error('保存文件失败：' + (error.message || '未知错误'));
    }
  }

  static stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.innerText || tmp.textContent || '';
  }

  static async exportTxt(content: string, fileName: string, customPath?: string): Promise<void> {
    const text = this.stripHtml(content);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    await this.downloadBlob(blob, this.getFileName(fileName, 'txt'), customPath);
  }

  static async exportPdf(content: string, fileName: string, customPath?: string): Promise<void> {
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
      let canvas;
      try {
        canvas = await html2canvas(container.firstElementChild as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });
      } catch (canvasError: any) {
        throw new Error('PDF生成失败（html2canvas）：' + (canvasError.message || '请重试'));
      }

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

      const isNative = Capacitor.isNativePlatform();
      if (isNative || 'showSaveFilePicker' in window) {
        const pdfOutput = pdf.output('arraybuffer');
        const pdfBlob = new Blob([pdfOutput], { type: 'application/pdf' });
        await this.downloadBlob(pdfBlob, this.getFileName(fileName, 'pdf'), customPath);
      } else {
        pdf.save(this.getFileName(fileName, 'pdf'));
      }
    } finally {
      document.body.removeChild(container);
    }
  }

  static async exportDoc(content: string, fileName: string, customPath?: string): Promise<void> {
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${fileName}</title></head>
      <body style="font-family: 'Microsoft YaHei', 'SimSun', sans-serif; font-size: 18px; line-height: 1.8;">
        ${content}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword;charset=utf-8',
    });
    await this.downloadBlob(blob, this.getFileName(fileName, 'doc'), customPath);
  }

  static async exportDocx(content: string, fileName: string, customPath?: string): Promise<void> {
    const html = `
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; font-size: 18px; line-height: 1.8;">
          ${content}
        </body>
      </html>
    `;
    const blob = new Blob([html], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8',
    });
    await this.downloadBlob(blob, this.getFileName(fileName, 'docx'), customPath);
  }

  static async export(
    format: ExportFormat,
    content: string,
    fileName: string,
    customPath?: string
  ): Promise<void> {
    switch (format) {
      case 'txt':
        await this.exportTxt(content, fileName, customPath);
        break;
      case 'pdf':
        await this.exportPdf(content, fileName, customPath);
        break;
      case 'doc':
        await this.exportDoc(content, fileName, customPath);
        break;
      case 'docx':
        await this.exportDocx(content, fileName, customPath);
        break;
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
    // 记录导出路径
    if (customPath) {
      localStorage.setItem('easyText_lastExportPath', customPath);
    }
    // 记录导出时间
    localStorage.setItem('easyText_lastExportTime', String(Date.now()));
  }
}
