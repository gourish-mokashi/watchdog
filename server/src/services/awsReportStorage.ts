import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const awsRegion = process.env.AWS_REGION;
const awsBucket = process.env.AWS_S3_BUCKET;

const parsedTtl = Number.parseInt(process.env.REPORT_URL_TTL_SECONDS ?? "600", 10);
const signedUrlTtlSeconds =
  Number.isFinite(parsedTtl) && parsedTtl > 0 ? Math.min(600, Math.max(300, parsedTtl)) : 600;

const s3Client =
  awsRegion && awsBucket
    ? new S3Client({
        region: awsRegion,
      })
    : null;

const getS3Context = (): { client: S3Client; bucket: string } => {
  if (!s3Client || !awsBucket) {
    throw new Error("AWS S3 is not configured. Set AWS_REGION and AWS_S3_BUCKET.");
  }
  return {
    client: s3Client,
    bucket: awsBucket,
  };
};

const toS3Key = (storedPath: string): string => {
  if (!storedPath) return "";

  if (storedPath.startsWith("s3://")) {
    const withoutScheme = storedPath.slice("s3://".length);
    const firstSlash = withoutScheme.indexOf("/");
    if (firstSlash <= 0) return "";

    const bucket = withoutScheme.slice(0, firstSlash);
    const key = withoutScheme.slice(firstSlash + 1);
    if (bucket !== awsBucket) return "";
    return key;
  }

  return storedPath;
};

export const uploadThreatReportPdf = async (eventId: string, pdfBuffer: Buffer): Promise<string> => {
  const { client, bucket } = getS3Context();

  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const objectKey = `threat-reports/${eventId}/analysis-${safeTimestamp}.pdf`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentDisposition: `inline; filename="${eventId}.pdf"`,
      CacheControl: "private, max-age=0, no-cache",
    }),
  );

  return `s3://${bucket}/${objectKey}`;
};

export const getSignedThreatReportUrl = async (storedPath: string): Promise<string> => {
  try {
    const { client, bucket } = getS3Context();
    const objectKey = toS3Key(storedPath);
    if (!objectKey) return "";

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: "inline",
    });

    return await getSignedUrl(client, command, { expiresIn: signedUrlTtlSeconds });
  } catch {
    return "";
  }
};
