declare namespace xl {
  class Workbook {
    constructor(...args: any[]);
    addWorksheet(name: string): Worksheet;
    createStyle(style: any): any;
    write?(fileName: string, response?: any): Promise<void> | void;
  }

  class Worksheet {
    cell(...args: any[]): Cell;
    row(index: number): Row;
    column(index: number): Column;
    addDataValidation?(validation: any): Worksheet;
    freeze?(...args: any[]): Worksheet;
    merge?(...args: any[]): Worksheet;
    name?: string;
  }

  class Cell {
    string(value: any): Cell;
    number(value: any): Cell;
    value(value: any): Cell;
    style(style: any): Cell;
  }

  class Row {
    cell(index: number): Cell;
    setHeight(height: number): Row;
  }

  class Column {
    setWidth(width: number): Column;
  }
}

declare module "excel4node" {
  export = xl;
}

export as namespace xl;
