#!/usr/bin/env python3
"""Isolated installer regressions. Never invokes Tizen, SDB, or a real TV.

Run from the repository root: python3 -B -m unittest discover -s tests -v
"""
import contextlib
import hashlib
import io
import os
from pathlib import Path
import shutil
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
import zipfile


SOURCE_REPO = Path(os.environ.get('HACKTV_TEST_REPO', Path(__file__).resolve().parents[1])).resolve()
ROOT_ASSETS = ('config.xml', 'index.html', 'style.css', 'app.js', 'icon.png')
LOGOS = ('3cat', 'appletv', 'atresplayer', 'disneyplus', 'hbomax', 'movistar',
         'flow', 'internet', 'jellyfin', 'netflix', 'plex', 'primevideo',
         'rakuten', 'sonance', 'spotify', 'tessel', 'xuper', 'youtube')
GLOW = ('3cat', 'apple', 'atres', 'brew', 'default', 'disney', 'gallery', 'hbo',
        'internet', 'movistar', 'netflix', 'plex', 'prime', 'rakuten', 'sky', 'youtube')
EXPECTED_ENTRIES = set(ROOT_ASSETS) | {'config.js', 'apps.js'} | {
    'logos/' + name + '.png' for name in LOGOS
} | {'glow/' + name + '.png' for name in GLOW}


def snapshot(base):
    """Records content, directory existence, and link destinations without following links."""
    result = {}
    for item in sorted(base.rglob('*')):
        name = item.relative_to(base).as_posix()
        if item.is_symlink():
            result[name] = ('symlink', os.readlink(item))
        elif item.is_dir():
            result[name] = ('directory',)
        else:
            result[name] = ('file', hashlib.sha256(item.read_bytes()).hexdigest())
    return result


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='home installer test ')
        self.addCleanup(self.temp.cleanup)
        self.case = Path(self.temp.name)
        self.repo = self.case / 'repo'
        self.launcher = self.repo / 'launcher'
        self.launcher.mkdir(parents=True)
        # Copy a known clean fixture; do not import personal generated config or build files.
        source_launcher = SOURCE_REPO / 'launcher'
        for name in ROOT_ASSETS + ('config.example.js', 'apps.example.js'):
            shutil.copyfile(source_launcher / name, self.launcher / name)
        for directory, names in (('logos', LOGOS), ('glow', GLOW)):
            (self.launcher / directory).mkdir()
            for name in names:
                shutil.copyfile(source_launcher / directory / (name + '.png'),
                                self.launcher / directory / (name + '.png'))
        self.external = self.case / 'external'
        self.external.mkdir()
        source = SOURCE_REPO / 'instalar.py'
        self.installer = types.ModuleType('installer_security_under_test')
        self.installer.__file__ = str(source)
        # exec compile loads in memory and never creates __pycache__ in the source repository.
        exec(compile(source.read_bytes(), str(source), 'exec'), self.installer.__dict__)
        self.installer.BASE = self.repo
        self.output = io.StringIO()
        self.stdout = contextlib.redirect_stdout(self.output)
        self.stderr = contextlib.redirect_stderr(self.output)
        self.stdout.__enter__()
        self.addCleanup(self.stdout.__exit__, None, None, None)
        self.stderr.__enter__()
        self.addCleanup(self.stderr.__exit__, None, None, None)

    def assert_rejected_without_mutation(self):
        before = snapshot(self.case)
        with self.assertRaises((ValueError, OSError, RuntimeError)):
            self.installer.prepare()
        self.assertEqual(before, snapshot(self.case), 'Rejection must happen before any mutation')

    def main(self, *args):
        with patch.object(sys, 'argv', ['instalar.py', *args]):
            return self.installer.main()

    def test_rejects_unexpected_dotenv_in_logos_before_mutation(self):
        (self.launcher / 'logos' / '.env').write_text('EXAMPLE_SECRET=private-fixture\n')
        self.assert_rejected_without_mutation()

    def test_rejects_unexpected_private_key_in_glow_before_mutation(self):
        (self.launcher / 'glow' / 'private.key').write_text('private-fixture-key\n')
        self.assert_rejected_without_mutation()

    def test_build_symlink_preserves_external_package_sentinel(self):
        (self.external / 'package').mkdir()
        (self.external / 'package' / 'sentinel').write_text('must-survive')
        (self.repo / 'build').symlink_to(self.external, target_is_directory=True)
        self.assert_rejected_without_mutation()

    def test_output_symlink_does_not_overwrite_external_file(self):
        (self.repo / 'build').mkdir()
        victim = self.external / 'keep.txt'
        victim.write_text('must-survive')
        (self.repo / 'build' / 'Home-unsigned.wgt').symlink_to(victim)
        self.assert_rejected_without_mutation()

    def test_dangling_config_symlink_does_not_create_external_file(self):
        (self.launcher / 'config.js').symlink_to(self.external / 'missing-config.js')
        self.assert_rejected_without_mutation()

    def test_dangling_apps_symlink_does_not_create_external_file(self):
        (self.launcher / 'apps.js').symlink_to(self.external / 'missing-apps.js')
        self.assert_rejected_without_mutation()

    def test_rejects_launcher_directory_symlink_before_mutation(self):
        moved = self.external / 'launcher'
        self.launcher.rename(moved)
        self.launcher.symlink_to(moved, target_is_directory=True)
        self.assert_rejected_without_mutation()

    def test_rejects_logos_directory_symlink_before_mutation(self):
        self.check_asset_directory_symlink('logos')

    def test_rejects_glow_directory_symlink_before_mutation(self):
        self.check_asset_directory_symlink('glow')

    def check_asset_directory_symlink(self, name):
        original = self.launcher / name
        moved = self.external / name
        original.rename(moved)
        original.symlink_to(moved, target_is_directory=True)
        self.assert_rejected_without_mutation()

    def test_rejects_nested_asset_symlink_before_mutation(self):
        original = self.launcher / 'logos' / 'youtube.png'
        moved = self.external / 'youtube.png'
        original.rename(moved)
        original.symlink_to(moved)
        self.assert_rejected_without_mutation()

    def test_rejects_stage_directory_symlink_before_mutation(self):
        (self.repo / 'build').mkdir()
        (self.external / 'sentinel').write_text('must-survive')
        (self.repo / 'build' / 'package').symlink_to(self.external, target_is_directory=True)
        self.assert_rejected_without_mutation()

    def test_clean_build_has_exactly_41_entries_with_original_bytes(self):
        stage = self.installer.prepare()
        self.assertEqual(stage, self.repo / 'build' / 'package')
        self.assertEqual(len(EXPECTED_ENTRIES), 41)
        self.assertEqual((self.launcher / 'config.js').read_bytes(),
                         (self.launcher / 'config.example.js').read_bytes())
        self.assertEqual((self.launcher / 'apps.js').read_bytes(),
                         (self.launcher / 'apps.example.js').read_bytes())
        with zipfile.ZipFile(self.repo / 'build' / 'Home-unsigned.wgt') as archive:
            self.assertEqual(set(archive.namelist()), EXPECTED_ENTRIES)
            self.assertEqual(len(archive.namelist()), 41)
            for name in EXPECTED_ENTRIES:
                self.assertEqual(archive.read(name), (self.launcher / name).read_bytes(), name)
                self.assertEqual((stage / name).read_bytes(), (self.launcher / name).read_bytes(), name)
        # Rebuilding replaces only the normal local stage and preserves existing local config.
        (self.launcher / 'config.js').write_text('var CONFIG = {};\n')
        (stage / 'stale-marker').write_text('remove-stale-stage-file')
        self.assertEqual(self.installer.prepare(), stage)
        self.assertFalse((stage / 'stale-marker').exists())
        self.assertEqual((self.launcher / 'config.js').read_text(), 'var CONFIG = {};\n')

    def test_main_without_options_only_prepares(self):
        with patch.object(self.installer, 'run') as run, \
                patch.object(self.installer.shutil, 'which') as which:
            self.main()
        run.assert_not_called()
        which.assert_not_called()
        self.assertTrue((self.repo / 'build' / 'Home-unsigned.wgt').is_file())

    def fake_tizen(self, args, cwd=None):
        self.assertIsInstance(args, list)
        self.assertIsNone(cwd)
        if args[:2] == ['tizen', 'package']:
            stage = Path(args[-1])
            self.assertEqual(stage, self.repo / 'build' / 'package')
            with zipfile.ZipFile(stage / 'Home signed.wgt', 'w') as signed:
                signed.writestr('author-signature.xml', '<fixture-author/>')
                signed.writestr('signature1.xml', '<fixture-distributor/>')

    def test_profile_preserves_argument_and_only_packages(self):
        profile = 'Perfil TV salón; $HOME'
        stage = self.repo / 'build' / 'package'
        with patch.object(self.installer, 'run', side_effect=self.fake_tizen) as run, \
                patch.object(self.installer.shutil, 'which', return_value='/mock/tizen') as which:
            self.main('--profile', profile)
        which.assert_called_with('tizen')
        self.assertEqual(run.call_args_list, [unittest.mock.call(
            ['tizen', 'package', '-t', 'wgt', '-s', profile, '--', str(stage)])])

    def test_install_preserves_profile_target_and_signed_filename(self):
        profile = 'Perfil TV salón; $HOME'
        target = '192.0.2.25:26101'
        stage = self.repo / 'build' / 'package'
        with patch.object(self.installer, 'run', side_effect=self.fake_tizen) as run, \
                patch.object(self.installer.shutil, 'which', return_value='/mock/tizen'):
            self.main('--profile', profile, '--target', target, '--install')
        self.assertEqual(run.call_args_list, [
            unittest.mock.call(['tizen', 'package', '-t', 'wgt', '-s', profile, '--', str(stage)]),
            unittest.mock.call(['tizen', 'install', '-n', 'Home signed.wgt', '-s', target, '--', str(stage)]),
        ])

    def test_uninstall_requires_target_and_never_prepares(self):
        target = '192.0.2.25:26101'
        before = snapshot(self.case)
        with patch.object(self.installer, 'run') as run, \
                patch.object(self.installer, 'prepare') as prepare, \
                patch.object(self.installer.shutil, 'which', return_value='/mock/tizen'):
            self.main('--desinstalar', '--target', target)
        run.assert_called_once_with(['tizen', 'uninstall', '-p', 'HkTvHome01', '-s', target])
        prepare.assert_not_called()
        self.assertEqual(before, snapshot(self.case))

    def test_missing_required_cli_arguments_reject_before_mutation(self):
        invalid = [('--install',), ('--install', '--profile', 'profile'),
                   ('--install', '--target', '192.0.2.25:26101'), ('--desinstalar',)]
        for args in invalid:
            with self.subTest(args=args):
                before = snapshot(self.case)
                with patch.object(self.installer, 'run') as run, \
                        patch.object(self.installer, 'prepare') as prepare, \
                        self.assertRaises(SystemExit) as error:
                    self.main(*args)
                self.assertEqual(error.exception.code, 2)
                run.assert_not_called()
                prepare.assert_not_called()
                self.assertEqual(before, snapshot(self.case))

    def test_profile_requires_tizen_before_mutation(self):
        before = snapshot(self.case)
        with patch.object(self.installer.shutil, 'which', return_value=None), \
                patch.object(self.installer, 'run') as run, \
                patch.object(self.installer, 'prepare') as prepare, \
                self.assertRaises(SystemExit) as error:
            self.main('--profile', 'my-profile')
        self.assertEqual(error.exception.code, 2)
        run.assert_not_called()
        prepare.assert_not_called()
        self.assertEqual(before, snapshot(self.case))


if __name__ == '__main__':
    unittest.main(verbosity=2)
