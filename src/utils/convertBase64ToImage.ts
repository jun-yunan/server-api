import fs from 'fs';

export const convertBase64ToImage = (
  base64String: string,
  outputFilePath: string,
) => {
  // Tách metadata ra khỏi Base64
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

  // Chuyển Base64 thành buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Ghi buffer ra tệp
  fs.writeFileSync(outputFilePath, new Uint8Array(buffer));
  console.log('File saved at:', outputFilePath);
};
