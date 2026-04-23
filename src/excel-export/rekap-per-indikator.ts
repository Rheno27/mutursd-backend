import * as xl from 'excel4node';

export interface RekapPerIndikatorWorkbookInput {
  kategori: string;
  tahun: number;
  data: Array<{
    judul: string;
    standar: string;
    data_bulan: Array<number | null>;
    data_tw: Array<number | null>;
  }>;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const TW_LABELS = ['TW1', 'TW2', 'TW3', 'TW4'];

function percentText(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }
  return `${Number(value).toFixed(2)}%`;
}

function applyCellValue(cell: any, value: number | null): void {
  cell.string(percentText(value));
}

export function buildRekapPerIndikatorWorkbook(input: RekapPerIndikatorWorkbookInput): xl.Workbook {
  const workbook = new xl.Workbook();
  const worksheet = workbook.addWorksheet('Rekap Per Indikator');

  const headerStyle = workbook.createStyle({
    font: { bold: true, color: '#FFFFFF' },
    fill: {
      type: 'pattern',
      patternType: 'solid',
      fgColor: '#4F81BD'
    },
    alignment: {
      horizontal: 'center',
      vertical: 'center',
      wrapText: true
    },
    border: {
      left: { style: 'thin', color: '#D9D9D9' },
      right: { style: 'thin', color: '#D9D9D9' },
      top: { style: 'thin', color: '#D9D9D9' },
      bottom: { style: 'thin', color: '#D9D9D9' }
    }
  });

  const bodyStyle = workbook.createStyle({
    alignment: {
      horizontal: 'center',
      vertical: 'center',
      wrapText: true
    },
    border: {
      left: { style: 'thin', color: '#D9D9D9' },
      right: { style: 'thin', color: '#D9D9D9' },
      top: { style: 'thin', color: '#D9D9D9' },
      bottom: { style: 'thin', color: '#D9D9D9' }
    }
  });

  const leftStyle = workbook.createStyle({
    alignment: {
      horizontal: 'left',
      vertical: 'center',
      wrapText: true
    },
    border: {
      left: { style: 'thin', color: '#D9D9D9' },
      right: { style: 'thin', color: '#D9D9D9' },
      top: { style: 'thin', color: '#D9D9D9' },
      bottom: { style: 'thin', color: '#D9D9D9' }
    }
  });

  const twStyles = [
    workbook.createStyle({
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { type: 'pattern', patternType: 'solid', fgColor: '#FCE4D6' },
      border: {
        left: { style: 'thin', color: '#D9D9D9' },
        right: { style: 'thin', color: '#D9D9D9' },
        top: { style: 'thin', color: '#D9D9D9' },
        bottom: { style: 'thin', color: '#D9D9D9' }
      }
    }),
    workbook.createStyle({
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { type: 'pattern', patternType: 'solid', fgColor: '#E2F0D9' },
      border: {
        left: { style: 'thin', color: '#D9D9D9' },
        right: { style: 'thin', color: '#D9D9D9' },
        top: { style: 'thin', color: '#D9D9D9' },
        bottom: { style: 'thin', color: '#D9D9D9' }
      }
    }),
    workbook.createStyle({
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { type: 'pattern', patternType: 'solid', fgColor: '#DDEBF7' },
      border: {
        left: { style: 'thin', color: '#D9D9D9' },
        right: { style: 'thin', color: '#D9D9D9' },
        top: { style: 'thin', color: '#D9D9D9' },
        bottom: { style: 'thin', color: '#D9D9D9' }
      }
    }),
    workbook.createStyle({
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { type: 'pattern', patternType: 'solid', fgColor: '#FFF2CC' },
      border: {
        left: { style: 'thin', color: '#D9D9D9' },
        right: { style: 'thin', color: '#D9D9D9' },
        top: { style: 'thin', color: '#D9D9D9' },
        bottom: { style: 'thin', color: '#D9D9D9' }
      }
    })
  ];

  const title = `Rekap Per Indikator - ${input.kategori} (${input.tahun})`;
  const columns = ['No', 'Variabel', 'Standar', ...MONTH_LABELS, ...TW_LABELS];

  worksheet.cell(1, 1, 1, columns.length, true).string(title);
  worksheet.row(1).setHeight(22);

  columns.forEach((column, index) => {
    worksheet.cell(3, index + 1).string(column).style(headerStyle);
    if (index === 1) {
      worksheet.column(index + 1).setWidth(42);
    } else if (index === 2) {
      worksheet.column(index + 1).setWidth(28);
    } else {
      worksheet.column(index + 1).setWidth(12);
    }
  });

  worksheet.row(3).setHeight(28);

  input.data.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 4;
    worksheet.cell(excelRow, 1).number(rowIndex + 1).style(bodyStyle);
    worksheet.cell(excelRow, 2).string(row.judul || '').style(leftStyle);
    worksheet.cell(excelRow, 3).string(row.standar || '').style(leftStyle);

    row.data_bulan.forEach((value, index) => {
      const cell = worksheet.cell(excelRow, index + 4);
      applyCellValue(cell, value);
      cell.style(bodyStyle);
    });

    row.data_tw.forEach((value, index) => {
      const cell = worksheet.cell(excelRow, index + 16);
      applyCellValue(cell, value);
      cell.style(twStyles[index]);
    });
  });

  return workbook;
}