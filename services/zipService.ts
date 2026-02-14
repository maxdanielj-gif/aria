import JSZip from 'jszip';

export const exportProjectAsZip = async (projectFiles: Record<string, string>) => {
    try {
        const zip = new JSZip();

        // Add provided project files
        for (const [path, content] of Object.entries(projectFiles)) {
            zip.file(path, content);
        }

        // Optimized zip generation for larger datasets by using compression sparingly
        // and generating as a Blob to minimize string memory allocation.
        const blob = await zip.generateAsync({ 
            type: 'blob',
            compression: "DEFLATE",
            compressionOptions: {
                level: 3 // Lower compression level is faster and uses less peak memory
            }
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai-companion-project-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 1000);
    } catch (error) {
        console.error("ZIP Generation Error:", error);
        throw error;
    }
};