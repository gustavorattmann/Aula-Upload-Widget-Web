import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { uploadFileToStorage } from "../http/upload-file-to-storage";
import { CanceledError } from "axios";

enableMapSet();

export type Upload = {
  name: string;
  file: File;
  abortController: AbortController;
  status: "progress" | "success" | "error" | "canceled";
  originalSizeInBytes: number;
  uploadSizeInBytes: number;
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
          {
            file: upload.file,
            onProgress: (sizeInBytes) => {
              set((state) => {
                state.uploads.set(uploadId, {
                  ...upload,
                  uploadSizeInBytes: sizeInBytes,
                });
              });
            },
          },
          { signal: upload.abortController.signal },
        );

        set((state) => {
          state.uploads.set(uploadId, { ...upload, status: "success" });
        });
      } catch (err) {
        if (err instanceof CanceledError) {
          set((state) => {
            state.uploads.set(uploadId, { ...upload, status: "canceled" });
          });

          return;
        }

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
          originalSizeInBytes: file.size,
          uploadSizeInBytes: 0,
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
