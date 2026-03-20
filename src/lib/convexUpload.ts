export async function uploadFileToConvex(
  file: File,
  generateUploadUrl: (args: Record<string, never>) => Promise<string>
): Promise<{ storageId: string }> {
  const uploadUrl = await generateUploadUrl({});
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  return (await response.json()) as { storageId: string };
}
