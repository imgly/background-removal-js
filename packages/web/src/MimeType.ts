export class MimeType {
  type: string = 'application/octet-stream';
  params: Record<string, string> = {};

  private constructor(type: string, params: Record<string, string>) {
    this.type = type;
    this.params = params;
  }

  toString(): string {
    const paramsStr = [];
    for (const key in this.params) {
      const value = this.params[key];
      paramsStr.push(`${key}=${value}`);
    }
    return [this.type, ...paramsStr].join(';');
  }

  static create(type, params: Record<string, string>): MimeType {
    return new MimeType(type, params);
  }

  isIdentical(other: MimeType): Boolean {
    return this.type === other.type && this.params === other.params;
  }

  isEqual(other: MimeType): Boolean {
    return this.type === other.type;
  }

  static fromString(mimeType: string): MimeType {
    const [type, ...paramsArr] = mimeType.split(';');
    const params: Record<string, string> = {};

    for (const param of paramsArr) {
      const [key, value] = param.split('=');
      params[key.trim()] = value.trim();
    }
    return new MimeType(type, params);
  }
}
