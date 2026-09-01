plugins {
    id("com.android.application")
}

android {
    namespace = "com.nitubakery.manager"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.nitubakery.manager"
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

dependencies {
    // Trusted Web Activity launcher — runs the admin dashboard in the real
    // Chrome engine, which is what keeps closed-app web push working.
    implementation("androidx.browser:browser:1.8.0")
}