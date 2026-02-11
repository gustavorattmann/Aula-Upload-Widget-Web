import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { uploadFileToStorage } from "../http/upload-file-to-storage";
import { CanceledError } from "axios";
import { useShallow } from "zustand/shallow";

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
  updateUpload: (uploadId: string, data: Partial<Upload>) => void;
};

export const useUploads = create<UploadState>()(
  immer((set, get) => ({
    uploads: new Map(),
    updateUpload: (uploadId: string, data: Partial<Upload>) => {
      const upload = get().uploads.get(uploadId);

      if (!upload) {
        return;
      }

      set((state) => {
        state.uploads.set(uploadId, { ...upload, ...data });
      });
    },
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
              get().updateUpload(uploadId, { uploadSizeInBytes: sizeInBytes });
            },
          },
          { signal: upload.abortController.signal },
        );

        get().updateUpload(uploadId, { status: "success" });
      } catch (err) {
        if (err instanceof CanceledError) {
          get().updateUpload(uploadId, { status: "canceled" });

          return;
        }

        get().updateUpload(uploadId, { status: "error" });
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

export const usePendingUploads = () => {
  return useUploads(
    useShallow((store) => {
      const isThereAnyPendingUploads = Array.from(store.uploads.values()).some(
        (upload) => upload.status === "progress",
      );

      if (!isThereAnyPendingUploads) {
        return { isThereAnyPendingUploads, globalPercentage: 100 };
      }

      const { total, uploaded } = Array.from(store.uploads.values()).reduce(
        (acc, upload) => {
          acc.total += upload.originalSizeInBytes;
          acc.uploaded += upload.uploadSizeInBytes;

          return acc;
        },
        { total: 0, uploaded: 0 },
      );

      const globalPercentage = Math.min(
        Math.round((uploaded * 100) / total),
        100,
      );

      return { isThereAnyPendingUploads, globalPercentage };
    }),
  );
};
