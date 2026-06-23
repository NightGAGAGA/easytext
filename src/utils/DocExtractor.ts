/**
 * 轻量级 .doc (Word 97-2003) 二进制文本提取器
 * 原理：直接搜索 OLE 文件中的 UTF-16 LE 和 GBK 编码文本区域。
 * 对于 .doc 格式，只提取纯文本（格式丢失），不解析复杂排版。
 */

interface ExtractResult {
  text: string;
  method: string;
}

/**
 * 检查是否是 OLE 复合文档格式
 */
function isOleDocument(bytes: Uint8Array): boolean {
  return bytes.length >= 8
    && bytes[0] === 0xD0
    && bytes[1] === 0xCF
    && bytes[2] === 0x11
    && bytes[3] === 0xE0
    && bytes[4] === 0xA1
    && bytes[5] === 0xB1
    && bytes[6] === 0x1A
    && bytes[7] === 0xE1;
}

/**
 * 从文件中搜索 UTF-16 LE 文本区域
 * 中文 .doc 通常用 UTF-16 LE 存储文字
 */
function extractUtf16leText(bytes: Uint8Array): string {
  const textChunks: string[] = [];
  let i = 512;

  while (i < bytes.length - 1) {
    let start = -1;
    let j = i;
    let validCount = 0;

    while (j < bytes.length - 1) {
      const low = bytes[j];
      const high = bytes[j + 1];
      const code = low | (high << 8);

      // 有效的 Unicode 可打印字符（包括中文、英文、标点）
      const isValid = (
        (code >= 0x20 && code <= 0x7E) ||   // ASCII
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK
        (code >= 0x3000 && code <= 0x303F) || // CJK 标点
        (code >= 0xFF00 && code <= 0xFFEF) || // 全角
        (code === 0x0D) || (code === 0x0A) || (code === 0x09) || // 换行
        (code >= 0x2000 && code <= 0x206F) || // 通用标点
        (code >= 0x3400 && code <= 0x4DBF) || // CJK 扩展A
        (code >= 0xF900 && code <= 0xFAFF)    // CJK 兼容
      );

      // 排除高字节异常值（OLE 元数据通常在高字节有异常值）
      const isReasonable = high === 0x00 || high === 0x30 ||
        (high >= 0x40 && high <= 0x9F) ||
        (high >= 0xE0 && high <= 0xFF);

      if (isValid && isReasonable) {
        if (start === -1) start = j;
        validCount++;
        j += 2;
      } else {
        break;
      }
    }

    if (start !== -1 && validCount >= 10) {
      const chunkBytes = bytes.slice(start, j);
      const chars: string[] = [];
      for (let k = 0; k < chunkBytes.length - 1; k += 2) {
        const code = chunkBytes[k] | (chunkBytes[k + 1] << 8);
        if (code === 0x0D) {
          chars.push('\n');
        } else if (code >= 0x20 || code === 0x09) {
          chars.push(String.fromCharCode(code));
        }
      }
      const text = chars.join('').trim();
      // 只保留包含实际文字内容的片段（至少 5 个有意义字符）
      if (text.length >= 5 && (/[\u4e00-\u9fa5]/.test(text) || /[a-zA-Z]{3,}/.test(text))) {
        textChunks.push(text);
      }
    }

    i = j + 1;
  }

  return textChunks.join('\n');
}

/**
 * 从文件中搜索 GBK 编码文本区域
 */
function extractGbkText(bytes: Uint8Array): string {
  const chunks: number[][] = [];
  let current: number[] = [];

  for (let i = 512; i < bytes.length; i++) {
    const isASCII = bytes[i] >= 0x20 && bytes[i] <= 0x7E;
    const isGBK = bytes[i] >= 0x81 && bytes[i] <= 0xFE
      && i + 1 < bytes.length
      && bytes[i + 1] >= 0x40 && bytes[i + 1] <= 0xFE
      && bytes[i + 1] !== 0x7F;
    const isSpace = bytes[i] === 0x20 || bytes[i] === 0x0D || bytes[i] === 0x0A || bytes[i] === 0x09;
    const isPunct = bytes[i] >= 0xA1 && bytes[i] <= 0xA3 && i + 1 < bytes.length
      && bytes[i + 1] >= 0xA1 && bytes[i + 1] <= 0xFE;

    if (isASCII || isSpace) {
      current.push(bytes[i]);
    } else if (isGBK || isPunct) {
      current.push(bytes[i]);
      current.push(bytes[i + 1]);
      i++;
    } else {
      if (current.length >= 8) {
        chunks.push([...current]);
      }
      current = [];
    }
  }

  if (current.length >= 8) {
    chunks.push(current);
  }

  const allBytes = new Uint8Array(chunks.flat());
  if (allBytes.length === 0) return '';

  try {
    if (typeof TextDecoder !== 'undefined') {
      const decoder = new TextDecoder('gbk');
      return decoder.decode(allBytes);
    }
  } catch (e) {}

  return '';
}

/**
 * 检查文件是否是本应用导出的 HTML 伪装 .doc
 */
export function isHtmlDisguisedDoc(bytes: Uint8Array): boolean {
  const checkLen = Math.min(bytes.length, 500);
  for (let i = 0; i < checkLen; i++) {
    if (bytes[i] === 0x3C) {
      const snippet = String.fromCharCode.apply(null, bytes.slice(i, Math.min(i + 10, bytes.length)) as any);
      const lower = snippet.toLowerCase();
      if (lower.startsWith('<html') || lower.startsWith('<!doctype') || lower.startsWith('<body') ||
          lower.startsWith('<head') || lower.startsWith('<meta')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 主提取函数：从 .doc 二进制文件中提取文本
 */
export async function extractDocText(bytes: Uint8Array): Promise<ExtractResult> {
  // 1. 检查是否是 OLE 文档
  if (!isOleDocument(bytes)) {
    return { text: '', method: 'not-ole' };
  }

  // 2. 尝试提取 UTF-16 LE 文本（大多数中文 .doc 的编码方式）
  const utf16Text = extractUtf16leText(bytes);
  if (utf16Text.length > 20) {
    return { text: utf16Text, method: 'utf16-le' };
  }

  // 3. 尝试提取 GBK 文本
  const gbkText = extractGbkText(bytes);
  if (gbkText.length > 20) {
    return { text: gbkText, method: 'gbk' };
  }

  return { text: '', method: 'failed' };
}

export default extractDocText;
