import { Routes } from '@angular/router';

// Lazy loading: cada pantalla se descarga solo cuando se visita
export const routes: Routes = [
  {
    path: '',
    title: 'Buscar documentos',
    loadComponent: () => import('./features/search/search-page').then((m) => m.SearchPage),
  },
  {
    path: 'upload',
    title: 'Cargar documentos',
    loadComponent: () => import('./features/upload/upload-page').then((m) => m.UploadPage),
  },
  {
    path: 'documents/:id',
    title: 'Documento',
    loadComponent: () => import('./features/document/document-page').then((m) => m.DocumentPage),
  },
  { path: '**', redirectTo: '' },
];
