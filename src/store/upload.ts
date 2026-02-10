import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { uploadFileToStorage } from "../http/upload-file-to-storage";

enableMapSet();

export type Upload = {
  name: string;
  file: File;
};

type UploadState = {
  uploads: Map<string, Upload>;
  addUploads: (files: File[]) => void;
  proccessUpload: (uploadId: string) => Promise<void>;
};

export const useUploads = create<UploadState>()(
  immer((set, get) => ({
    uploads: new Map(),
    proccessUpload: async (uploadId: string) => {
      const upload = get().uploads.get(uploadId);

      console.log("Processing upload:", upload);

      if (!upload) {
        return;
      }

      await uploadFileToStorage({ file: upload.file });
    },
    addUploads: (files: File[]) => {
      for (const file of files) {
        const uploadId = crypto.randomUUID();

        const upload: Upload = {
          name: file.name,
          file,
        };

        set((state) => {
          state.uploads.set(uploadId, upload);
        });

        get().proccessUpload(uploadId);
      }
    },
  })),
);
