#!/usr/bin/env python3
"""Prepara Home; firma e instala solo con opciones explícitas y herramientas oficiales."""
import argparse
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import zipfile

BASE = Path(__file__).resolve().parent
FILES = ('config.xml', 'index.html', 'style.css', 'app.js', 'apps.js', 'icon.png', 'config.js')
# Inventario explícito: nunca copiar carpetas completas ni archivos privados adicionales.
ASSETS = {
    'logos': ('3cat.png', 'appletv.png', 'atresplayer.png', 'disneyplus.png',
              'flow.png', 'hbomax.png', 'internet.png', 'jellyfin.png',
              'movistar.png', 'netflix.png', 'plex.png', 'primevideo.png',
              'rakuten.png', 'sonance.png', 'spotify.png', 'tessel.png', 'xuper.png', 'youtube.png'),
    'glow': ('3cat.png', 'apple.png', 'atres.png', 'brew.png', 'default.png',
             'disney.png', 'gallery.png', 'hbo.png', 'internet.png',
             'movistar.png', 'netflix.png', 'plex.png', 'prime.png',
             'rakuten.png', 'sky.png', 'youtube.png'),
}


def run(args, cwd=None):
    subprocess.run(args, cwd=cwd, check=True)


def check_path(path, directory=False, missing_ok=False):
    """lstat detecta también enlaces colgantes; rechaza junctions de Windows."""
    try:
        info = path.lstat()
    except FileNotFoundError:
        if missing_ok:
            return False
        raise
    reparse = getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0)
    if stat.S_ISLNK(info.st_mode) or reparse:
        raise ValueError('No se permiten enlaces simbólicos: ' + str(path))
    valid = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if not valid:
        raise ValueError('Se esperaba un ' + ('directorio: ' if directory else 'archivo regular: ') + str(path))
    return True


def check_destinations():
    build = BASE / 'build'
    check_path(build, directory=True, missing_ok=True)
    stage = build / 'package'
    if check_path(stage, directory=True, missing_ok=True):
        # No borrar un árbol previo con enlaces o archivos especiales.
        for root, dirs, files in os.walk(stage):
            for name in dirs:
                check_path(Path(root) / name, directory=True)
            for name in files:
                check_path(Path(root) / name)
    check_path(build / 'Home-unsigned.wgt', missing_ok=True)


def prepare():
    launcher = BASE / 'launcher'
    check_path(BASE, directory=True)
    check_path(launcher, directory=True)
    check_destinations()
    defaults = []
    # Completar todas las comprobaciones antes de crear configuraciones o borrar un build.
    for name in FILES:
        src = launcher / name
        if not check_path(src, missing_ok=name in ('apps.js', 'config.js')):
            example = launcher / (src.stem + '.example.js')
            check_path(example)
            defaults.append((src, example))
    packaged = list(FILES)
    for folder, names in ASSETS.items():
        source = launcher / folder
        check_path(source, directory=True)
        for child in source.iterdir():
            if child.name not in names:
                raise ValueError('Archivo no permitido en assets: ' + str(child))
        for name in names:
            check_path(source / name)
            packaged.append(folder + '/' + name)
    for dest, example in defaults:
        # Creación exclusiva: no seguir un enlace introducido en un destino ausente.
        with dest.open('xb') as target, example.open('rb') as source:
            shutil.copyfileobj(source, target)
        if dest.name == 'config.js':
            print('Creado config.js sin ubicación ni claves. Personalízalo si quieres.')
    build = BASE / 'build'
    build.mkdir(exist_ok=True)
    stage = build / 'package'
    output = build / 'Home-unsigned.wgt'
    # Preparar en un directorio privado; publicar solo cuando todo esté copiado.
    with tempfile.TemporaryDirectory(prefix='.home-', dir=build) as temporary:
        temporary = Path(temporary)
        pending = temporary / 'package'
        pending.mkdir()
        for name in packaged:
            dest = pending / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(launcher / name, dest)
        archive = temporary / 'Home-unsigned.wgt'
        with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as z:
            for name in sorted(packaged):
                # Metadatos neutros; sin rutas absolutas ni usuario del ordenador.
                info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                z.writestr(info, (pending / name).read_bytes())
        check_destinations()
        if stage.exists():
            shutil.rmtree(stage)
        pending.replace(stage)
        archive.replace(output)
    print('Paquete SIN FIRMA creado: build/Home-unsigned.wgt. No se puede instalar todavía.')
    return stage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', help='Nombre de tu perfil Samsung TV del Certificate Manager')
    parser.add_argument('--target', help='Serial exacto de sdb devices (solo para tu TV)')
    parser.add_argument('--install', action='store_true', help='Instalar el paquete firmado')
    parser.add_argument('--desinstalar', action='store_true', help='Desinstalar Home del target indicado')
    args = parser.parse_args()
    if args.desinstalar:
        if not args.target:
            parser.error('--desinstalar requiere --target')
        run(['tizen', 'uninstall', '-p', 'HkTvHome01', '-s', args.target])
        return
    if args.install and (not args.profile or not args.target):
        parser.error('--install requiere --profile y --target')
    if args.profile and not shutil.which('tizen'):
        parser.error('Falta tizen en PATH: instala Tizen Studio y las extensiones de Samsung TV')
    stage = prepare()
    if not args.profile:
        return
    run(['tizen', 'package', '-t', 'wgt', '-s', args.profile, '--', str(stage)])
    signed = list(stage.glob('*.wgt'))
    if len(signed) != 1:
        raise RuntimeError('Se esperaba exactamente un paquete firmado en build/package')
    with zipfile.ZipFile(signed[0]) as z:
        if not {'author-signature.xml', 'signature1.xml'} <= set(z.namelist()):
            raise RuntimeError('Faltan firmas en el paquete generado; no se instalará')
    print('Paquete firmado generado. La TV validará la cadena y permisos del certificado.')
    if args.install:
        run(['tizen', 'install', '-n', signed[0].name, '-s', args.target, '--', str(stage)])
        print('Abre Home desde Apps. Return sale de la aplicación.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        raise SystemExit('Error: ' + str(error))
