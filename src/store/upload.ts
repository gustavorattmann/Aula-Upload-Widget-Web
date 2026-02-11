import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { uploadFileToStorage } from "../http/upload-file-to-storage";

enableMapSet();

export type Upload = {
  name: string;
  file: File;
  abortController: AbortController;
  status: "progress" | "success" | "error" | "canceled";
};

type UploadState = {
  uploads: Map<string, Upload>;
  addUploads: (files: File[]) => void;
  proccessUpload: (uploadId: string) => Promise<void>;
  cancelUpload: (uploadId: string) => void;
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

      try {
        await uploadFileToStorage(
          { file: upload.file },
          { signal: upload.abortController.signal },
        );

        set((state) => {
          state.uploads.set(uploadId, { ...upload, status: "success" });
        });
      } catch {
        set((state) => {
          state.uploads.set(uploadId, { ...upload, status: "error" });
        });
      }
    },
    addUploads: (files: File[]) => {
      for (const file of files) {
        const uploadId = crypto.randomUUID();
        const abortController = new AbortController();

        const upload: Upload = {
          name: file.name,
          file,
          abortController,
          status: "progress",
        };

        set((state) => {
          state.uploads.set(uploadId, upload);
        });

        get().proccessUpload(uploadId);
      }
    },
    cancelUpload: (uploadId: string) => {
      const upload = get().uploads.get(uploadId);

      if (!upload) {
        return;
      }

      upload.abortController.abort();

      set((state) => {
        state.uploads.set(uploadId, { ...upload, status: "canceled" });
      });
    },
  })),
);
