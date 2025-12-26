import { contextBridge, desktopCapturer } from 'electron';

contextBridge.exposeInMainWorld('env', {
  // Use if you choose to read env from the main process later
});

contextBridge.exposeInMainWorld('capture', {
  // Optional: list screens/sources for capture
  listSources: async () => {
    return desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 400, height: 300 } });
  }
});