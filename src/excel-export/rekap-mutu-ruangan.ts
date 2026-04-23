import * as xl from 'excel4node';

export interface RekapMutuRuanganWorkbookInput {
  ruanganId: string;
  namaRuangan: string;
  bulan: number;
  tahun: number;
  data: Array<{
    no: number;
    variabel: string;
    byTanggal: Record<string, { pasien_sesuai: number; total_pasien: number }>;
    jumlah_total: number;
    jumlah_sesuai: number;
    persen: number | null;
  }>;
}

function getLastDayOfMonth(bulan: number, tahun: number): number {
  return new Date(tahun, bulan, 0).getDate();
}

function percentText(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }
  return `${value.toFixed(2)}%`;
}

function cellValueText(value: { pasien_sesuai: number; total_pasien: number } | undefined): string {
  if (!value) {
    return '';
  }

  const pasienSesuai = Number(value.pasien_sesuai || 0);
  const totalPasien = Number(value.total_pasien || 0);

  if (totalPasien <= 0) {
    return `${pasienSesuai}`;
  }

  return `${pasienSesuai}/${totalPasien}`;
}

export function buildRekapMutuRuanganWorkbook(input: RekapMutuRuanganWorkbookInput): xl.Workbook {
  const workbook = new xl.Workbook();
  const worksheet = workbook.addWorksheet('Rekap Mutu Ruangan');

  const headerStyle = workbook.createStyle({
    font: {
      bold: true,
      color: '#FFFFFF'
    },
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

  const title = `Rekap Mutu Ruangan - ${input.namaRuangan} (${input.bulan}/${input.tahun})`;
  const lastDay = getLastDayOfMonth(input.bulan, input.tahun);
  const columns = ['No', 'Variabel'];
  for (let day = 1; day <= lastDay; day += 1) {
    columns.push(`tgl-${day}`);
  }
  columns.push('Jumlah', '%');

  worksheet.cell(1, 1, 1, columns.length, true).string(title);
  worksheet.row(1).setHeight(22);

  columns.forEach((column, index) => {
    worksheet.cell(3, index + 1).string(column).style(headerStyle);
    if (index === 1) {
      worksheet.column(index + 1).setWidth(40);
    } else if (index >= 2 && index < columns.length - 2) {
      worksheet.column(index + 1).setWidth(12);
    } else {
      worksheet.column(index + 1).setWidth(14);
    }
  });

  worksheet.row(3).setHeight(28);

  input.data.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 4;
    worksheet.cell(excelRow, 1).number(Number(row.no || rowIndex + 1)).style(bodyStyle);
    worksheet.cell(excelRow, 2).string(row.variabel || '').style(leftStyle);

    for (let day = 1; day <= lastDay; day += 1) {
      const value = row.byTanggal[String(day)];
      const cell = worksheet.cell(excelRow, day + 2);
      if (value) {
        cell.string(cellValueText(value)).style(bodyStyle);
      } else {
        cell.string('').style(bodyStyle);
      }
    }

    worksheet.cell(excelRow, lastDay + 3).number(Number(row.jumlah_total || 0)).style(bodyStyle);
    worksheet.cell(excelRow, lastDay + 4).string(percentText(row.persen)).style(bodyStyle);
  });

  return workbook;
}