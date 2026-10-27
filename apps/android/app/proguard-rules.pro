# The app has no reflection or JavaScript interfaces (the page talks to the app through androidx.webkit's
# WebMessageListener), so the default Android rules are enough. Keep line numbers for readable crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
