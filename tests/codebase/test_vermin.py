#-----------------------------------------------------------------------------
# Copyright (c) Anaconda, Inc. All rights reserved.
#
# Powered by the Bokeh Development Team.
#
# The full license is in the file LICENSE.txt, distributed with this software.
#-----------------------------------------------------------------------------

#-----------------------------------------------------------------------------
# Boilerplate
#-----------------------------------------------------------------------------
from __future__ import annotations # isort:skip

import pytest ; pytest

#-----------------------------------------------------------------------------
# Imports
#-----------------------------------------------------------------------------

# Standard library imports
from os import chdir
from subprocess import run

# External imports
import toml

# Bokeh imports
from tests.support.util.project import TOP_PATH

#-----------------------------------------------------------------------------
# Tests
#-----------------------------------------------------------------------------

def test_vermin() -> None:
    chdir(TOP_PATH)
    pyproject = toml.load(TOP_PATH / "pyproject.toml")
    minpy = pyproject["project"]["requires-python"].lstrip(">=")
    cmd = ["vermin", "--eval-annotations", "--no-tips", f"-t={minpy}", "-vvv", "--lint", "--exclude-regex", "\\.pyi$", "src/bokeh"]
    proc = run(cmd, capture_output=True)
    assert proc.returncode == 0, f"vermin issues:\n{proc.stdout.decode('utf-8')}"

#-----------------------------------------------------------------------------
# Support
#-----------------------------------------------------------------------------
