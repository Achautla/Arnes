-- Carpeta privada «modelos» para llevar los .glb entre tus dispositivos.
-- Los archivos van al almacenamiento de objetos de Supabase (Storage), no a las tablas de la base de datos:
-- la base solo guarda una fila pequeña con el nombre de cada archivo. Plan gratis: 1 GB y 50 MB por archivo.
-- Cómo usarlo: Supabase → tu proyecto → SQL Editor → pega esto → Run. Solo se corre una vez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('modelos', 'modelos', false, 52428800, array['model/gltf-binary','application/octet-stream'])
on conflict (id) do nothing;

create policy "modelos: leer los propios" on storage.objects for select to authenticated
  using (bucket_id = 'modelos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "modelos: subir a su carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'modelos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "modelos: reemplazar los propios" on storage.objects for update to authenticated
  using (bucket_id = 'modelos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "modelos: borrar los propios" on storage.objects for delete to authenticated
  using (bucket_id = 'modelos' and (storage.foldername(name))[1] = (select auth.uid())::text);
