// ══════════════════════════════════════════════════════════
// Headcount Control — Google Apps Script Web App
// Cole este código em: Extensions > Apps Script (na sua planilha)
// Depois publique: Deploy > New deployment > Web App
//   Execute as: Me | Who has access: Anyone
// ══════════════════════════════════════════════════════════

const SHEET_NAME = 'HeadcountDB';
const CHAVES_VALIDAS = ['escalas', 'logFull', 'diaristas', 'historico', 'dataGlobal'];
const LIMITE_BYTES = 200000; // 200 KB por segurança

function doGet(e) {
  try {
    const sheet = _getSheet();
    const data = {};

    if (sheet.getLastRow() > 0) {
      const rows = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
      for (const [chave, valor] of rows) {
        if (!CHAVES_VALIDAS.includes(chave)) continue;
        // Google Sheets converte strings de data para objetos Date automaticamente
        // então precisamos formatar de volta para yyyy-MM-dd
        if (chave === 'dataGlobal') {
          data[chave] = valor instanceof Date
            ? Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(valor);
        } else {
          data[chave] = _parseJSON(valor, []);
        }
      }
    }

    return _resposta({ ok: true, data });
  } catch (err) {
    return _resposta({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) throw new Error('Body vazio');
    if (e.postData.contents.length > LIMITE_BYTES) throw new Error('Payload muito grande');

    const body = JSON.parse(e.postData.contents);
    const sheet = _getSheet();

    // Lê chaves existentes para saber qual linha atualizar
    const existentes = sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat()
      : [];

    for (const chave of CHAVES_VALIDAS) {
      if (!(chave in body)) continue;

      const valor = chave === 'dataGlobal'
        ? String(body[chave]).substring(0, 20)   // max 20 chars para data
        : JSON.stringify(body[chave]);

      const linha = existentes.indexOf(chave);
      if (linha >= 0) {
        sheet.getRange(linha + 1, 2).setValue(valor);
      } else {
        sheet.appendRow([chave, valor]);
        existentes.push(chave);
      }
    }

    return _resposta({ ok: true });
  } catch (err) {
    return _resposta({ ok: false, error: err.message });
  }
}

// ── Utilitários ────────────────────────────────────────────

function _getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function _parseJSON(str, fallback) {
  try { return JSON.parse(str); }
  catch (e) { return fallback; }
}

function _resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
