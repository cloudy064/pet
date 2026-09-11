window.PIPI_FLIGHT = {
  "version": 2,
  "assets": {
    "takeoff": {
      "version": 1,
      "id": "takeoff",
      "label": "起飞蓄力",
      "image": "pipi-flight-takeoff.png",
      "frameWidth": 704,
      "frameHeight": 576,
      "frameCount": 29,
      "columns": 29,
      "anchor": {
        "x": 352,
        "y": 486.45303867403317
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        80,
        96,
        633,
        489
      ],
      "frameDurationsMs": [
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 805,
      "loop": false,
      "frameRate": 30,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        }
      ],
      "coordinateSpace": "Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.",
      "provenance": {
        "frontAtlas": "pipi-flight-front-generated.png",
        "sideAtlas": "pipi-flight-side-generated.png",
        "flapAtlas": "pipi-flight-flap-generated.png",
        "turnAtlas": "pipi-flight-turn-generated.png",
        "method": "Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow."
      },
      "restPose": {
        "image": "pipi-idle.png",
        "scale": 0.7071823204419889,
        "x": 224,
        "y": 48,
        "width": 256,
        "height": 512,
        "frames": [
          0
        ]
      },
      "phases": [
        {
          "label": "蓄力",
          "start": 0,
          "end": 16
        },
        {
          "label": "蹬地展翅",
          "start": 17,
          "end": 28
        }
      ],
      "originalTiming": {
        "durationMs": 966.6666666666671,
        "frameDurationsMs": [
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336
        ]
      },
      "timingRevision": 1,
      "timingNote": "Clear anticipation, brisk lift / touchdown, and a soft final settle.",
      "timingMode": "per-frame"
    },
    "hover": {
      "version": 1,
      "id": "hover",
      "label": "正面扑翼 · 悬停 / 上下",
      "image": "pipi-flight-hover.png",
      "frameWidth": 704,
      "frameHeight": 576,
      "frameCount": 32,
      "columns": 32,
      "anchor": {
        "x": 352,
        "y": 486.45303867403317
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        79,
        88,
        636,
        505
      ],
      "frameDurationsMs": [
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0
      ],
      "durationMs": 800.0,
      "loop": true,
      "frameRate": 40,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        }
      ],
      "coordinateSpace": "Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.",
      "provenance": {
        "frontAtlas": "pipi-flight-front-generated.png",
        "sideAtlas": "pipi-flight-side-generated.png",
        "flapAtlas": "pipi-flight-flap-generated.png",
        "turnAtlas": "pipi-flight-turn-generated.png",
        "method": "Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow."
      }
    },
    "right": {
      "version": 1,
      "id": "right",
      "label": "向右飞行",
      "image": "pipi-flight-right.png",
      "frameWidth": 704,
      "frameHeight": 576,
      "frameCount": 32,
      "columns": 32,
      "anchor": {
        "x": 352,
        "y": 486.45303867403317
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        43,
        86,
        604,
        449
      ],
      "frameDurationsMs": [
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0
      ],
      "durationMs": 800.0,
      "loop": true,
      "frameRate": 40,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        }
      ],
      "coordinateSpace": "Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.",
      "provenance": {
        "frontAtlas": "pipi-flight-front-generated.png",
        "sideAtlas": "pipi-flight-side-generated.png",
        "flapAtlas": "pipi-flight-flap-generated.png",
        "turnAtlas": "pipi-flight-turn-generated.png",
        "method": "Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow."
      }
    },
    "left": {
      "version": 1,
      "id": "left",
      "label": "向左飞行",
      "image": "pipi-flight-left.png",
      "frameWidth": 704,
      "frameHeight": 576,
      "frameCount": 32,
      "columns": 32,
      "anchor": {
        "x": 352,
        "y": 486.45303867403317
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        100,
        86,
        661,
        449
      ],
      "frameDurationsMs": [
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0
      ],
      "durationMs": 800.0,
      "loop": true,
      "frameRate": 40,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        }
      ],
      "coordinateSpace": "Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.",
      "provenance": {
        "frontAtlas": "pipi-flight-front-generated.png",
        "sideAtlas": "pipi-flight-side-generated.png",
        "flapAtlas": "pipi-flight-flap-generated.png",
        "turnAtlas": "pipi-flight-turn-generated.png",
        "method": "Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow."
      }
    },
    "turn-right": {
      "version": 1,
      "id": "turn-right",
      "label": "正面转向右侧",
      "image": "pipi-flight-turn-right.png",
      "frameWidth": 704,
      "frameHeight": 576,
      "frameCount": 17,
      "columns": 17,
      "anchor": {
        "x": 352,
        "y": 486.45303867403317
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        43,
        94,
        633,
        481
      ],
      "frameDurationsMs": [
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0
      ],
      "durationMs": 425.0,
      "loop": false,
      "frameRate": 40,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        }
      ],
      "coordinateSpace": "Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.",
      "provenance": {
        "frontAtlas": "pipi-flight-front-generated.png",
        "sideAtlas": "pipi-flight-side-generated.png",
        "flapAtlas": "pipi-flight-flap-generated.png",
        "turnAtlas": "pipi-flight-turn-generated.png",
        "method": "Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow."
      }
    },
    "turn-left": {
      "version": 1,
      "id": "turn-left",
      "label": "正面转向左侧",
      "image": "pipi-flight-turn-left.png",
      "frameWidth": 704,
      "frameHeight": 576,
      "frameCount": 17,
      "columns": 17,
      "anchor": {
        "x": 352,
        "y": 486.45303867403317
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        80,
        94,
        661,
        481
      ],
      "frameDurationsMs": [
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0,
        25.0
      ],
      "durationMs": 425.0,
      "loop": false,
      "frameRate": 40,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25.0
        }
      ],
      "coordinateSpace": "Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.",
      "provenance": {
        "frontAtlas": "pipi-flight-front-generated.png",
        "sideAtlas": "pipi-flight-side-generated.png",
        "flapAtlas": "pipi-flight-flap-generated.png",
        "turnAtlas": "pipi-flight-turn-generated.png",
        "method": "Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow."
      }
    },
    "land": {
      "version": 1,
      "id": "land",
      "label": "落地回稳",
      "image": "pipi-flight-land.png",
      "frameWidth": 704,
      "frameHeight": 576,
      "frameCount": 41,
      "columns": 41,
      "anchor": {
        "x": 352,
        "y": 486.45303867403317
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        80,
        96,
        633,
        489
      ],
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        30,
        30,
        30,
        30,
        30,
        30,
        30,
        80
      ],
      "durationMs": 1115,
      "loop": false,
      "frameRate": 30,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 22528,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 25
        },
        {
          "x": 23232,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 23936,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 24640,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 25344,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 26048,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 26752,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 27456,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 30
        },
        {
          "x": 28160,
          "y": 0,
          "w": 704,
          "h": 576,
          "durationMs": 80
        }
      ],
      "coordinateSpace": "Local sprite. World flight translation is separate. Anchor is the neutral sole origin; flight feet tuck above it.",
      "provenance": {
        "frontAtlas": "pipi-flight-front-generated.png",
        "sideAtlas": "pipi-flight-side-generated.png",
        "flapAtlas": "pipi-flight-flap-generated.png",
        "turnAtlas": "pipi-flight-turn-generated.png",
        "method": "Generated key poses, raster registration, fixed hover core and bidirectional motion-compensated inbetweens. Front eyes use complete approved expression frames outside general optical flow."
      },
      "restPose": {
        "image": "pipi-idle.png",
        "scale": 0.7071823204419889,
        "x": 224,
        "y": 48,
        "width": 256,
        "height": 512,
        "frames": [
          40
        ]
      },
      "phases": [
        {
          "label": "伸脚准备",
          "start": 0,
          "end": 10
        },
        {
          "label": "缓冲收翅",
          "start": 11,
          "end": 32
        },
        {
          "label": "回到默认",
          "start": 33,
          "end": 40
        }
      ],
      "originalTiming": {
        "durationMs": 1366.6666666666663,
        "frameDurationsMs": [
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336,
          33.333333333333336
        ]
      },
      "timingRevision": 1,
      "timingNote": "Clear anticipation, brisk lift / touchdown, and a soft final settle.",
      "timingMode": "per-frame"
    },
    "up-right": {
      "version": 1,
      "id": "up-right",
      "label": "右上飞行",
      "image": "pipi-flight-up-right.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 32,
      "columns": 32,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        37,
        88,
        595,
        532
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 800,
      "loop": true,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    },
    "bank-up-right": {
      "version": 1,
      "id": "bank-up-right",
      "label": "右侧转向右上",
      "image": "pipi-flight-bank-up-right.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 17,
      "columns": 17,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        34,
        132,
        604,
        496
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 425,
      "loop": false,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    },
    "up-left": {
      "version": 1,
      "id": "up-left",
      "label": "左上飞行",
      "image": "pipi-flight-up-left.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 32,
      "columns": 32,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        109,
        88,
        667,
        532
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 800,
      "loop": true,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    },
    "bank-up-left": {
      "version": 1,
      "id": "bank-up-left",
      "label": "左侧转向左上",
      "image": "pipi-flight-bank-up-left.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 17,
      "columns": 17,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        100,
        132,
        670,
        496
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 425,
      "loop": false,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    },
    "down-right": {
      "version": 1,
      "id": "down-right",
      "label": "右下飞行",
      "image": "pipi-flight-down-right.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 32,
      "columns": 32,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        63,
        52,
        601,
        512
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 800,
      "loop": true,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    },
    "bank-down-right": {
      "version": 1,
      "id": "bank-down-right",
      "label": "右侧转向右下",
      "image": "pipi-flight-bank-down-right.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 17,
      "columns": 17,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        42,
        133,
        607,
        460
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 425,
      "loop": false,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    },
    "down-left": {
      "version": 1,
      "id": "down-left",
      "label": "左下飞行",
      "image": "pipi-flight-down-left.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 32,
      "columns": 32,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        103,
        52,
        641,
        512
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 800,
      "loop": true,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11968,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 12672,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 13376,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14080,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 14784,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 15488,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16192,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 16896,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 17600,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 18304,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19008,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 19712,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 20416,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21120,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 21824,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    },
    "bank-down-left": {
      "version": 1,
      "id": "bank-down-left",
      "label": "左侧转向左下",
      "image": "pipi-flight-bank-down-left.png",
      "frameWidth": 704,
      "frameHeight": 640,
      "frameCount": 17,
      "columns": 17,
      "anchor": {
        "x": 352,
        "y": 518.4530386740332
      },
      "subjectHeight": 387.5359116022099,
      "bounds": [
        97,
        133,
        662,
        460
      ],
      "frameRate": 40,
      "frameDurationsMs": [
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25,
        25
      ],
      "durationMs": 425,
      "loop": false,
      "frames": [
        {
          "x": 0,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 704,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 1408,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2112,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 2816,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 3520,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4224,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 4928,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 5632,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 6336,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7040,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 7744,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 8448,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9152,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 9856,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 10560,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        },
        {
          "x": 11264,
          "y": 0,
          "w": 704,
          "h": 640,
          "durationMs": 25
        }
      ],
      "provenance": {
        "method": "Previously stabilized image-generated right flight cycle, baked fixed body pitch and continuous bank transitions. Left partners are mirrored. New candidate atlases were rejected for inconsistent proportions.",
        "prompts": "pipi-flight-diagonal-generation.md"
      }
    }
  },
  "directions": {
    "up": "hover",
    "down": "hover",
    "right": "right",
    "left": "left",
    "up-right": "up-right",
    "up-left": "up-left",
    "down-right": "down-right",
    "down-left": "down-left"
  },
  "transitions": {
    "takeoffToHover": [
      28,
      0
    ],
    "hoverToLanding": [
      0,
      0
    ],
    "frontToRight": [
      "turn-right",
      "forward"
    ],
    "rightToFront": [
      "turn-right",
      "reverse"
    ],
    "frontToLeft": [
      "turn-left",
      "forward"
    ],
    "leftToFront": [
      "turn-left",
      "reverse"
    ]
  },
  "timing": {
    "wingbeatMs": 800,
    "turnMs": 425,
    "takeoffMs": 805,
    "landMs": 1115
  },
  "movement": {
    "units": "stage pixels per second",
    "speed": 190,
    "hoverAltitude": 130,
    "groundY": 650,
    "stageWidth": 1000,
    "stageHeight": 720,
    "spriteScale": 0.65,
    "boundaryPadding": 20,
    "accelerationSmoothingSeconds": 0.18
  },
  "notes": [
    "All strips have uniform 704 by 576 cells and shared anchor.",
    "Up/down are frontal screen-plane flight; left/right use three-quarter views.",
    "PNG contains local articulation. Apply stage/world movement once, outside the sprite.",
    "Turn only at wingbeat frame 0; use the transition backwards to face front before landing.",
    "Landing contact occurs at frame 10; drive world altitude to zero by that frame."
  ],
  "turnGraph": [
    {
      "from": "front",
      "to": "left",
      "clip": "turn-left"
    },
    {
      "from": "front",
      "to": "right",
      "clip": "turn-right"
    },
    {
      "from": "left",
      "to": "up-left",
      "clip": "bank-up-left"
    },
    {
      "from": "left",
      "to": "down-left",
      "clip": "bank-down-left"
    },
    {
      "from": "right",
      "to": "up-right",
      "clip": "bank-up-right"
    },
    {
      "from": "right",
      "to": "down-right",
      "clip": "bank-down-right"
    }
  ]
};
