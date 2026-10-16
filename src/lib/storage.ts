import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT || undefined, // set for R2/non-AWS
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;

export async function uploadResumeFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return key; // store this key in the DB; generate signed URLs on read
}

// Browsers (mobile Safari especially) have no built-in viewer for these, so opening one
// directly just shows a blank page - force a download/"open in..." instead. PDFs and images
// render fine inline everywhere, so those keep the normal in-browser preview.
const INLINE_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp']);

// forceDownload overrides the usual inline-for-viewable-types behavior - used by the "Save"
// link next to each resume so staff can save a copy straight to disk (e.g. for their shared
// drive) instead of it just opening in a browser tab, which is all a plain PDF link does.
export async function getResumeSignedUrl(key: string, fileName?: string, forceDownload = false): Promise<string> {
  const name = fileName || key.split('/').pop() || 'file';
  const extension = name.split('.').pop()?.toLowerCase() || '';
  const disposition = !forceDownload && INLINE_EXTENSIONS.has(extension) ? 'inline' : 'attachment';
  // Strip characters that would break the quoted-string header value.
  const safeName = name.replace(/["\r\n]/g, '');

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}