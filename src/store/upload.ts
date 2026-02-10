import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

enableMapSet();

export type Upload = {
  name: string;
  file: File;
};

type UploadState = {
  uploads: Map<string, Upload>;
  addUploads: (files: File[]) => void;
};

export const useUploads = create<UploadState>()(
  immer((set) => ({
    uploads: new Map(),
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
      }
    },
  })),
);
