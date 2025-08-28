export interface PresignResponse {
  upload_url: string;
  file_url: string;
  method: 'PUT' | 'POST';
  fields?: Record<string, string> | null;
}

export class UploadService {
  private backendUrl: string;

  constructor(backendUrl?: string) {
    this.backendUrl = backendUrl || (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000');
  }

  async presign(contentType: string, fileName: string): Promise<PresignResponse> {
    const accessToken = localStorage.getItem('access_token');
    const res = await fetch(`${this.backendUrl}/api/uploads/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ content_type: contentType, file_name: fileName })
    });
    if (!res.ok) {
      throw new Error(`Presign failed (${res.status})`);
    }
    return res.json();
  }

  async uploadBlob(blob: Blob, fileName = 'snapshot.jpg'): Promise<string> {
    const contentType = blob.type || 'image/jpeg';
    const { upload_url, file_url, method, fields } = await this.presign(contentType, fileName);

    if (method === 'PUT') {
      const putRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      return file_url;
    }

    // Multipart POST (not currently used, but kept for completeness)
    const form = new FormData();
    if (fields) Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    form.append('Content-Type', contentType);
    form.append('file', blob, fileName);
    const postRes = await fetch(upload_url, { method: 'POST', body: form });
    if (!postRes.ok) throw new Error(`Upload failed (${postRes.status})`);
    return file_url;
  }
}

