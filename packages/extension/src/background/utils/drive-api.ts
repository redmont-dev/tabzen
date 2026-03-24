const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface DriveFileList {
  files: DriveFile[];
}

export class DriveAPI {
  private getToken: () => Promise<string>;

  constructor(getToken: () => Promise<string>) {
    this.getToken = getToken;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return { Authorization: `Bearer ${token}` };
  }

  private async assertOk(response: Response, action: string): Promise<void> {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Drive API ${action} failed (${response.status}): ${text}`);
    }
  }

  async listFiles(): Promise<DriveFile[]> {
    const h = await this.headers();
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'files(id,name,mimeType,modifiedTime)',
      pageSize: '1000',
    });
    const response = await fetch(`${DRIVE_API_BASE}?${params}`, { headers: h });
    await this.assertOk(response, 'listFiles');
    const data: DriveFileList = await response.json();
    return data.files;
  }

  async createFile(name: string, content: string): Promise<DriveFile> {
    const h = await this.headers();
    const metadata = {
      name,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    };

    const boundary = '---tabzen-boundary';
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const response = await fetch(`${UPLOAD_API_BASE}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        ...h,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    await this.assertOk(response, 'createFile');
    return response.json();
  }

  async readFile(fileId: string): Promise<string> {
    const h = await this.headers();
    const response = await fetch(`${DRIVE_API_BASE}/${fileId}?alt=media`, { headers: h });
    await this.assertOk(response, 'readFile');
    return response.text();
  }

  async updateFile(fileId: string, content: string): Promise<DriveFile> {
    const h = await this.headers();
    const response = await fetch(`${UPLOAD_API_BASE}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        ...h,
        'Content-Type': 'application/json',
      },
      body: content,
    });
    await this.assertOk(response, 'updateFile');
    return response.json();
  }

  async deleteFile(fileId: string): Promise<void> {
    const h = await this.headers();
    const response = await fetch(`${DRIVE_API_BASE}/${fileId}`, {
      method: 'DELETE',
      headers: h,
    });
    await this.assertOk(response, 'deleteFile');
  }
}
