plugins {
    id("com.android.application")
}

android {
    namespace = "com.nitubakery.widget"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.nitubakery.widget"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

// Zero external dependencies: only the Android platform SDK is used,
// so the APK stays tiny and builds need no extra downloads.
dependencies {}