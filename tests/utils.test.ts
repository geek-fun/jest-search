import { getEngineBinaryURL, isZipFile, downloadZip, isFileExists } from '../src/utils';
import { EngineType } from '../src';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yazl from 'yazl';
import JSZip from 'jszip';

const mockedPlatform = jest.fn();
const mockedArch = jest.fn();

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  platform: () => mockedPlatform(),
  arch: () => mockedArch(),
}));

const platforms = [
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-darwin-x86_64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'darwin',
    arch: 'arm64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-darwin-aarch64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'linux',
    arch: 'x64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-linux-x86_64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-linux-aarch64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '6.8.23',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-6.8.23.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-linux-aarch64.tar.gz',
  },
  {
    engine: EngineType.OPENSEARCH,
    version: '2.9.0',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://artifacts.opensearch.org/releases/bundle/opensearch/2.9.0/opensearch-2.9.0-linux-x64.tar.gz',
  },
  {
    engine: EngineType.OPENSEARCH,
    version: '2.9.0',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://artifacts.opensearch.org/releases/bundle/opensearch/2.9.0/opensearch-2.9.0-linux-arm64.tar.gz',
  },
  {
    engine: EngineType.ZINCSEARCH,
    version: '0.4.7',
    platform: 'darwin',
    arch: 'x64',
    URL: 'https://github.com/zincsearch/zincsearch/releases/download/v0.4.7/zincsearch_0.4.7_darwin_x86_64.tar.gz',
  },
  {
    engine: EngineType.ZINCSEARCH,
    version: '0.4.7',
    platform: 'linux',
    arch: 'arm64',
    URL: 'https://github.com/zincsearch/zincsearch/releases/download/v0.4.7/zincsearch_0.4.7_linux_arm64.tar.gz',
  },
  {
    engine: EngineType.ELASTICSEARCH,
    version: '8.9.0',
    platform: 'win32',
    arch: 'x64',
    URL: 'https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.9.0-windows-x86_64.zip',
  },
  {
    engine: EngineType.OPENSEARCH,
    version: '2.9.0',
    platform: 'win32',
    arch: 'x64',
    URL: 'https://artifacts.opensearch.org/releases/bundle/opensearch/2.9.0/opensearch-2.9.0-windows-x64.zip',
  },
  {
    engine: EngineType.ZINCSEARCH,
    version: '0.4.7',
    platform: 'win32',
    arch: 'x64',
    URL: 'https://github.com/zincsearch/zincsearch/releases/download/v0.4.7/zincsearch_0.4.7_windows_x86_64.tar.gz',
  },
];

describe('unit test for utils', () => {
  describe('unit test for getEngineBinaryURL', () => {
    platforms.forEach(({ engine, version, platform, arch, URL }) => {
      it(`should return ${engine} ${version} ${platform} ${arch} download location`, () => {
        mockedPlatform.mockReturnValue(platform);
        mockedArch.mockReturnValue(arch);

        const binaryURL = getEngineBinaryURL(engine, version);
        expect(binaryURL).toEqual(URL);
      });
    });
  });

  describe('unit test for isZipFile', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-search-test-'));
    });

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should return true for valid ZIP files', () => {
      const zipPath = path.join(testDir, 'test.zip');
      // Create a valid ZIP file with PK header (0x504B)
      fs.writeFileSync(zipPath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));

      expect(isZipFile(zipPath)).toBe(true);
    });

    it('should return false for non-ZIP files', () => {
      const txtPath = path.join(testDir, 'test.txt');
      fs.writeFileSync(txtPath, 'This is not a ZIP file');

      expect(isZipFile(txtPath)).toBe(false);
    });

    it('should return false for gzip files', () => {
      const gzPath = path.join(testDir, 'test.gz');
      // Gzip magic number is 0x1F8B
      fs.writeFileSync(gzPath, Buffer.from([0x1f, 0x8b, 0x08, 0x00]));

      expect(isZipFile(gzPath)).toBe(false);
    });

    it('should return false for non-existent files', () => {
      const nonExistentPath = path.join(testDir, 'nonexistent.zip');

      expect(isZipFile(nonExistentPath)).toBe(false);
    });

    it('should return false for empty files', () => {
      const emptyPath = path.join(testDir, 'empty.zip');
      fs.writeFileSync(emptyPath, '');

      expect(isZipFile(emptyPath)).toBe(false);
    });
  });

  describe('unit test for downloadZip', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-search-test-'));
    });

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    const createTestZip = (
      zipPath: string,
      files: { name: string; content: string }[],
    ): Promise<void> => {
      return new Promise((resolve, reject) => {
        const zipFile = new yazl.ZipFile();

        files.forEach(({ name, content }) => {
          zipFile.addBuffer(Buffer.from(content), name);
        });

        zipFile.end();

        const writeStream = fs.createWriteStream(zipPath);
        zipFile.outputStream.pipe(writeStream);

        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    };

    it('should successfully extract a valid ZIP file', async () => {
      const zipPath = path.join(testDir, 'test.zip');
      const extractPath = path.join(testDir, 'extracted');

      await createTestZip(zipPath, [
        { name: 'file1.txt', content: 'Hello World' },
        { name: 'file2.txt', content: 'Test Content' },
      ]);

      await downloadZip(zipPath, extractPath);

      expect(isFileExists(path.join(extractPath, 'file1.txt'))).toBe(true);
      expect(isFileExists(path.join(extractPath, 'file2.txt'))).toBe(true);
      expect(fs.readFileSync(path.join(extractPath, 'file1.txt'), 'utf8')).toBe('Hello World');
      expect(fs.readFileSync(path.join(extractPath, 'file2.txt'), 'utf8')).toBe('Test Content');
    });

    it('should extract files in subdirectories', async () => {
      const zipPath = path.join(testDir, 'test.zip');
      const extractPath = path.join(testDir, 'extracted');

      await createTestZip(zipPath, [
        { name: 'dir1/file1.txt', content: 'File in dir1' },
        { name: 'dir2/subdir/file2.txt', content: 'File in nested dir' },
      ]);

      await downloadZip(zipPath, extractPath);

      expect(isFileExists(path.join(extractPath, 'dir1/file1.txt'))).toBe(true);
      expect(isFileExists(path.join(extractPath, 'dir2/subdir/file2.txt'))).toBe(true);
      expect(fs.readFileSync(path.join(extractPath, 'dir1/file1.txt'), 'utf8')).toBe(
        'File in dir1',
      );
    });

    it('should reject path traversal attempts with ../', async () => {
      const zipPath = path.join(testDir, 'malicious.zip');
      const extractPath = path.join(testDir, 'extracted');

      // Create a ZIP file containing a path traversal attempt
      const zip = new JSZip();
      zip.file('../../../etc/passwd', 'malicious content');
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(zipPath, content);

      // Defense in depth: Both yauzl (ZIP reading library) and our custom validation
      // reject path traversal attempts. This test verifies that malicious ZIPs are caught.
      await expect(downloadZip(zipPath, extractPath)).rejects.toThrow();

      // Verify no files were created in the extract directory
      if (isFileExists(extractPath)) {
        const files = fs.readdirSync(extractPath, { recursive: true });
        expect(files).toHaveLength(0);
      }
    });

    it('should reject path traversal attempts with ../../', async () => {
      const zipPath = path.join(testDir, 'malicious.zip');
      const extractPath = path.join(testDir, 'extracted');

      // Create a ZIP file containing a relative path traversal attempt
      const zip = new JSZip();
      zip.file('../../outside.txt', 'outside content');
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(zipPath, content);

      // Defense in depth: Both yauzl (ZIP reading library) and our custom validation
      // reject path traversal attempts. This test verifies that malicious ZIPs are caught.
      await expect(downloadZip(zipPath, extractPath)).rejects.toThrow();
    });

    it('should handle non-existent ZIP files', async () => {
      const nonExistentZip = path.join(testDir, 'nonexistent.zip');
      const extractPath = path.join(testDir, 'extracted');

      await expect(downloadZip(nonExistentZip, extractPath)).rejects.toThrow();
    });

    it('should handle empty ZIP files', async () => {
      const zipPath = path.join(testDir, 'empty.zip');
      const extractPath = path.join(testDir, 'extracted');

      await createTestZip(zipPath, []);

      await downloadZip(zipPath, extractPath);

      // Extract path may or may not exist for empty ZIPs, just ensure no errors
      expect(true).toBe(true);
    });
  });
});
