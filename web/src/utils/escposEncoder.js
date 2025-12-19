import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

export async function generarTicketEscPos() {
    const encoder = new ReceiptPrinterEncoder();

    // =========================
    // CONFIG 80MM (MANUAL 80XX)
    // =========================
    const PAPER_PX = 576;   // 80mm físico
    const SAFE_PX  = 576;   // seguimos dejando imprimir full
    const CHAR_PX  = 12;
    const CHARS_48 = 48;    // EXACTO lo que pediste

    // =========================
    // INIT
    // =========================
    encoder.initialize().codepage('cp858').align('left');

    // ancho físico 80mm
    encoder.raw([0x1D, 0x57, 0x40, 0x02]);

    // NO restringimos área lógica, solo texto crudo
    // =========================
    // TESTS — TODAS 48 CARACTERES
    // =========================

    // TEST 1 — todos iguales
    encoder.text('A'.repeat(CHARS_48)).newline();

    // TEST 2 — otro caracter
    encoder.text('B'.repeat(CHARS_48)).newline();

    // TEST 3 — mitad y mitad
    encoder.text('-'.repeat(24) + '#'.repeat(24)).newline();

    // TEST 4 — mismos largos, distintos glifos
    encoder.text('W'.repeat(48)).newline();
    encoder.text('i'.repeat(48)).newline();

    // TEST 5 — últimos 6 distintos (CRÍTICO)
    encoder.text('X'.repeat(42) + '######').newline();

    // TEST 6 — primeros 6 distintos
    encoder.text('######' + 'X'.repeat(42)).newline();

    // TEST 7 — mezcla random pero 48 exactos
    encoder.text('AB12-_=+*/!@#$%^&()[]{}'.padEnd(48, 'Z')).newline();

    // =========================
    // FIN
    // =========================
    encoder.newline(3).cut();
    return encoder.encode();
}
