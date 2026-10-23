import type { StoreName } from '../data/db';

/**
 * PREPARAÇÃO PARA BACKUP — exportar/importar ainda NÃO está implementado.
 *
 * Formato previsto: um arquivo privado do usuário com os registros de cada store.
 * Fotos só entram quando o usuário as seleciona (blobs ficam à parte).
 */
export interface BackupFile {
  app: 'fitness-app';
  formatVersion: 1;
  createdAt: string;
  stores: Partial<Record<StoreName, unknown[]>>;
  includedPhotoIds: string[];
}
