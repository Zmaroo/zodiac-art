"""Dataclasses for structured chart data."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlanetPlacement:
    """Planet position with sign and house information."""

    name: str
    longitude: float
    sign: str
    house: int


@dataclass(frozen=True)
class House:
    """House cusp data with sign."""

    number: int
    cusp_longitude: float
    sign: str


@dataclass(frozen=True)
class Chart:
    """Astrological chart container."""

    planets: list[PlanetPlacement]
    houses: list[House]
    ascendant: float
    midheaven: float
