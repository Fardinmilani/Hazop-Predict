# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = [('C:\\Users\\Fardin\\Desktop\\project\\Hazop-Predict\\frontend\\dist', 'frontend_dist'), ('C:\\Users\\Fardin\\Desktop\\project\\Hazop-Predict\\backend', 'backend')]
binaries = []
hiddenimports = ['app', 'config', 'sklearn.utils._typedefs', 'sklearn.utils._heap', 'sklearn.neighbors._typedefs', 'sklearn.neighbors._quad_tree']
tmp_ret = collect_all('sklearn')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('xgboost')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]
tmp_ret = collect_all('catboost')
datas += tmp_ret[0]; binaries += tmp_ret[1]; hiddenimports += tmp_ret[2]


a = Analysis(
    ['main_desktop.py'],
    pathex=['C:\\Users\\Fardin\\Desktop\\project\\Hazop-Predict', 'C:\\Users\\Fardin\\Desktop\\project\\Hazop-Predict\\backend'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='HAZOP-Analysis-Tool',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
