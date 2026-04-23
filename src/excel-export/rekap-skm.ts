import * as xl from 'excel4node';

export interface RekapSkmWorkbookInput {
  bulan: number;
  tahun: number;
  namaRuangan: string;
  data: Array<Record<string, unknown>>;
}

function toDisplayValue(value: unknown): string | number {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value as string | number;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toDisplayValue(item)).join(', ');
  }

  return JSON.stringify(value);
}

function toHeaderLabel(key: string): string {
  const map: Record<string, string> = {
    idBioPasien: 'ID Bio Pasien',
    tanggal: 'Tanggal',
    namaPasien: 'Nama Pasien',
    jenisKelamin: 'Jenis Kelamin',
    pendidikan: 'Pendidikan',
    pekerjaan: 'Pekerjaan',
    ruangan: 'Ruangan',
    totalIkm: 'Total IKM'
  };

  return map[key] || key;
}

export function buildRekapSkmWorkbook(input: RekapSkmWorkbookInput): xl.Workbook {
  const workbook = new xl.Workbook();
  const worksheet = workbook.addWorksheet('Rekap SKM');

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

  const title = `Rekap SKM - ${input.namaRuangan} (${input.bulan}/${input.tahun})`;
  const firstRow = input.data[0] || {};
  const keys = Object.keys(firstRow);
  const preferredOrder = ['idBioPasien', 'tanggal', 'namaPasien', 'jenisKelamin', 'pendidikan', 'pekerjaan', 'ruangan'];
  const orderedKeys = [
    ...preferredOrder.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !preferredOrder.includes(key) && key !== 'totalIkm')
  ];

  if (keys.includes('totalIkm')) {
    orderedKeys.push('totalIkm');
  }

  if (orderedKeys.length === 0) {
    orderedKeys.push('totalIkm');
  }

  worksheet.cell(1, 1, 1, orderedKeys.length, true).string(title);
  worksheet.row(1).setHeight(22);

  orderedKeys.forEach((key, index) => {
    worksheet.cell(3, index + 1).string(toHeaderLabel(key)).style(headerStyle);
    worksheet.column(index + 1).setWidth(index === 0 ? 18 : 18);
  });

  worksheet.row(3).setHeight(28);

  input.data.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 4;
    orderedKeys.forEach((key, colIndex) => {
      const value = row[key];
      const cell = worksheet.cell(excelRow, colIndex + 1);
      const displayValue = toDisplayValue(value);

      if (typeof displayValue === 'number') {
        cell.number(displayValue).style(bodyStyle);
      } else {
        const style = colIndex === 0 || key === 'tanggal' || key === 'namaPasien' || key === 'ruangan' ? leftStyle : bodyStyle;
        cell.string(String(displayValue)).style(style);
      }
    });
  });

  return workbook;
}